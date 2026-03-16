import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  createTramiteChange,
  recordStatusChange,
} from "@/tramites/utils/tramiteChangesHelpers";

/**
 * CONTRACT RENEWAL ENDPOINT
 *
 * POST /api/v2/contracts/[id]/renewal
 *
 * Processes a contract renewal with the following operations (atomic transaction):
 * 1. Updates tramite: status → "Pendiente de Firma", liquidez_status → NULL,
 *    new dates, renewal_count + 1
 * 2. Updates contracts: type → "Renovación", optionally rotates companies
 * 3. Inserts snapshot into tramite_renewal_history
 * 4. Records granular changes in tramite_changes
 */

// ==================== VALIDATION SCHEMAS ====================

const ParamsSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
});

const RenewalBodySchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  activation_date: z.string().min(1, "Activation date is required"),
  renovation_date: z.string().min(1, "Renovation date is required"),
  company_changed: z.boolean().default(false),
  new_company_id: z.string().optional(),
});

// ==================== MAIN ENDPOINT HANDLER ====================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // ==================== PARAMETER VALIDATION ====================

    const { id: tramiteId } = await params;
    const paramValidation = ParamsSchema.safeParse({ id: tramiteId });
    if (!paramValidation.success) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    // ==================== BODY VALIDATION ====================

    const body = await request.json();
    const bodyValidation = RenewalBodySchema.safeParse(body);
    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Datos inválidos: ${bodyValidation.error.issues.map((i) => i.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const {
      user_id,
      activation_date,
      renovation_date,
      company_changed,
      new_company_id,
    } = bodyValidation.data;

    if (company_changed && !new_company_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requiere nueva compañía cuando hay cambio de compañía",
        },
        { status: 400 }
      );
    }

    // ==================== DATABASE CLIENT ====================

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // ==================== TRANSACTION ====================

    const tx = await tursoClient.transaction();

    try {
      // 1. Read current tramite state
      const tramiteResult = await tx.execute({
        sql: `SELECT id, activation_date, renovation_date, status, liquidez_status, renewal_count
              FROM tramites WHERE id = ? LIMIT 1`,
        args: [tramiteId],
      });

      if (tramiteResult.rows.length === 0) {
        await tx.rollback();
        return NextResponse.json(
          { success: false, error: "No existe el trámite" },
          { status: 404 }
        );
      }

      const currentTramite = tramiteResult.rows[0];
      const oldActivationDate = currentTramite.activation_date as string | null;
      const oldRenovationDate = currentTramite.renovation_date as string | null;
      const oldStatus = currentTramite.status as string;
      const oldLiquidezStatus = currentTramite.liquidez_status as
        | string
        | null;
      const currentRenewalCount = (currentTramite.renewal_count as number) || 0;
      const newRenewalCount = currentRenewalCount + 1;

      // 2. Read associated contracts
      const contractsResult = await tx.execute({
        sql: `SELECT id, type, old_company, new_company FROM contracts WHERE tramite_id = ?`,
        args: [tramiteId],
      });

      // Capture first contract's company info for history tracking
      const firstContract =
        contractsResult.rows.length > 0 ? contractsResult.rows[0] : null;
      const previousCompany = firstContract
        ? (firstContract.new_company as string)
        : null;
      const resolvedNewCompany = company_changed
        ? new_company_id!
        : previousCompany;

      // 3. Update tramite
      await tx.execute({
        sql: `UPDATE tramites
              SET status = 'Pendiente de Firma',
                  liquidez_status = NULL,
                  activation_date = ?,
                  renovation_date = ?,
                  renewal_count = ?
              WHERE id = ?`,
        args: [activation_date, renovation_date, newRenewalCount, tramiteId],
      });

      // 4. Update contracts
      if (company_changed && new_company_id) {
        await tx.execute({
          sql: `UPDATE contracts
                SET type = 'Renovación',
                    old_company = new_company,
                    new_company = ?
                WHERE tramite_id = ?`,
          args: [new_company_id, tramiteId],
        });
      } else {
        await tx.execute({
          sql: `UPDATE contracts SET type = 'Renovación' WHERE tramite_id = ?`,
          args: [tramiteId],
        });
      }

      // 5. Insert renewal history snapshot
      await tx.execute({
        sql: `INSERT INTO tramite_renewal_history (
                id, tramite_id, renewal_number, user_id,
                previous_activation_date, previous_renovation_date,
                new_activation_date, new_renovation_date,
                previous_status, previous_liquidez_status,
                company_changed, previous_company, new_company
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          tramiteId,
          newRenewalCount,
          user_id,
          oldActivationDate,
          oldRenovationDate,
          activation_date,
          renovation_date,
          oldStatus,
          oldLiquidezStatus,
          company_changed ? 1 : 0,
          previousCompany,
          resolvedNewCompany,
        ],
      });

      // 6. Record changes in tramite_changes

      // 6.1 Status change
      await recordStatusChange(
        tx,
        tramiteId,
        user_id,
        oldStatus,
        "Pendiente de Firma",
        `Renovación: Estado cambiado de "${oldStatus}" a "Pendiente de Firma"`
      );

      // 6.2 Liquidez status reset
      if (oldLiquidezStatus) {
        await createTramiteChange(tx, {
          tramite_id: tramiteId,
          user_id,
          change_type: "field_update",
          field_name: "liquidez_status",
          old_value: oldLiquidezStatus,
          new_value: null,
          description: "Renovación: Estado de liquidez reiniciado",
        });
      }

      // 6.3 Activation date change
      await createTramiteChange(tx, {
        tramite_id: tramiteId,
        user_id,
        change_type: "date_update",
        field_name: "activation_date",
        old_value: oldActivationDate,
        new_value: activation_date,
        description: `Renovación: Fecha de activación actualizada`,
      });

      // 6.4 Renovation date change
      await createTramiteChange(tx, {
        tramite_id: tramiteId,
        user_id,
        change_type: "date_update",
        field_name: "renovation_date",
        old_value: oldRenovationDate,
        new_value: renovation_date,
        description: `Renovación: Fecha de renovación actualizada`,
      });

      // 6.5 Contract type changes
      for (const contract of contractsResult.rows) {
        const oldType = contract.type as string;
        if (oldType !== "Renovación") {
          await createTramiteChange(tx, {
            tramite_id: tramiteId,
            user_id,
            change_type: "contract_updated",
            field_name: "contract.type",
            old_value: oldType,
            new_value: "Renovación",
            description: `Renovación: Tipo de contrato actualizado a "Renovación"`,
          });
        }
      }

      // 6.6 Renovation completed summary
      const companyDescription = company_changed
        ? `Contrato renovado y cambio de compañía de "${previousCompany}" a "${resolvedNewCompany}"`
        : `Contrato renovado, sin cambio de compañía "${previousCompany}"`;

      await createTramiteChange(tx, {
        tramite_id: tramiteId,
        user_id,
        change_type: "renovation_completed",
        field_name: "company",
        old_value: previousCompany,
        new_value: resolvedNewCompany,
        description: companyDescription,
      });

      // 6.7 Company change tracking (if applicable)
      if (company_changed && new_company_id) {
        for (const contract of contractsResult.rows) {
          const contractOldCompany = contract.old_company as string;
          const contractNewCompany = contract.new_company as string;

          await createTramiteChange(tx, {
            tramite_id: tramiteId,
            user_id,
            change_type: "contract_updated",
            field_name: "contract.old_company",
            old_value: contractOldCompany,
            new_value: contractNewCompany,
            description: `Renovación: Compañía anterior actualizada`,
          });

          await createTramiteChange(tx, {
            tramite_id: tramiteId,
            user_id,
            change_type: "contract_updated",
            field_name: "contract.new_company",
            old_value: contractNewCompany,
            new_value: new_company_id,
            description: `Renovación: Compañía actualizada de "${contractNewCompany}" a "${new_company_id}"`,
          });
        }
      }

      await tx.commit();

      return NextResponse.json({ success: true });
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    console.error("[ERROR] Contract renewal failed:", error);
    return NextResponse.json(
      { success: false, error: "Error updating tramite" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return POST(request, context);
}
