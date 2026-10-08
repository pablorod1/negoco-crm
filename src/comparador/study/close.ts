import type { Client, InValue, Transaction } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { proposalFileName, type ProposalRecord } from "./proposals";
import type { StudyRecord } from "./repository";
import { StudyError } from "./service";

/** Sube el PDF elegido a Storage y devuelve su enlace. */
export type ProposalUploader = (input: {
  path: string;
  data: Uint8Array;
}) => Promise<{ downloadUrl: string; remove: () => Promise<void> }>;

type Executor = Pick<Transaction, "execute">;

const OPEN_STATUSES = ["pending", "processing"];

async function audit(
  db: Executor,
  comparativaId: string,
  userId: string,
  change: { type: string; field: string | null; oldValue: InValue; newValue: InValue; description: string },
) {
  await db.execute({
    sql: `INSERT INTO comparativa_changes
      (id, comparativa_id, user_id, change_type, field_name, old_value, new_value, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      comparativaId,
      userId,
      change.type,
      change.field,
      change.oldValue === null ? null : String(change.oldValue),
      change.newValue === null ? null : String(change.newValue),
      change.description,
      new Date().toISOString(),
    ],
  });
}

/**
 * Completa el estudio con la propuesta elegida: su PDF pasa a los documentos
 * de la comparativa y la comparativa queda «Pendiente de revisión» con la
 * comercializadora, el tipo de tarifa y la comisión de agencia, como cuando
 * llega un estudio de Abarca. El reparto con el comercial lo calcula la
 * revisión con las reglas de siempre.
 *
 * El PDF se sube antes de la transacción; si la transacción falla, se borra.
 */
export async function closeStudy({
  client,
  study,
  proposal,
  pdf,
  userId,
  upload,
}: {
  client: Pick<Client, "execute" | "transaction">;
  study: StudyRecord;
  proposal: ProposalRecord;
  pdf: Uint8Array;
  userId: string;
  upload: ProposalUploader;
}): Promise<{ fileId: string }> {
  if (study.status === "closed") throw new StudyError("Este estudio ya está completado.", 409);
  if (proposal.studyId !== study.id) throw new StudyError("Esa propuesta no es de este estudio.", 404);

  const subject = await client.execute({
    sql: "SELECT status FROM comparativas WHERE id = ? LIMIT 1",
    args: [study.comparativaId],
  });
  if (!OPEN_STATUSES.includes(String(subject.rows[0]?.status))) {
    throw new StudyError("La comparativa ya no está pendiente de estudio.", 409);
  }

  const organization = await client.execute("SELECT id FROM organization LIMIT 1");
  const organizationId = String(organization.rows[0]?.id ?? "");
  if (!organizationId) throw new Error("Tenant without organization");

  const fileName = proposalFileName(proposal);
  const fileId = randomUUID();
  const stored = await upload({
    path: `${organizationId}/comparativas/${study.comparativaId}/${fileId}-${fileName}`,
    data: pdf,
  });

  const transaction = await client.transaction("write");
  try {
    const { rows } = await transaction.execute({
      sql: `SELECT status, plan, company_id, commission_segment, comision_fijo
        FROM comparativas WHERE id = ? LIMIT 1`,
      args: [study.comparativaId],
    });
    const comparativa = rows[0];
    if (!comparativa || !OPEN_STATUSES.includes(String(comparativa.status))) {
      throw new StudyError("La comparativa ya no está pendiente de estudio.", 409);
    }
    const claimed = await transaction.execute({
      sql: "UPDATE comparison_studies SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'closed'",
      args: [study.id],
    });
    if (claimed.rowsAffected === 0) throw new StudyError("Este estudio ya está completado.", 409);

    const now = new Date().toISOString();
    await transaction.execute({
      sql: `INSERT INTO comparativa_files
        (id, comparativa_id, filename, size, extension, upload_date, download_url, preview_url)
        VALUES (?, ?, ?, ?, 'pdf', ?, ?, NULL)`,
      args: [fileId, study.comparativaId, fileName, pdf.byteLength, now, stored.downloadUrl],
    });
    await audit(transaction, study.comparativaId, userId, {
      type: "document_upload",
      field: "filename",
      oldValue: null,
      newValue: fileName,
      description: `Documento subido: ${fileName}`,
    });

    const plans = JSON.parse(String(comparativa.plan ?? "[]")) as string[];
    if (!plans.includes("fijo")) {
      const next = JSON.stringify([...plans, "fijo"]);
      await transaction.execute({ sql: "UPDATE comparativas SET plan = ? WHERE id = ?", args: [next, study.comparativaId] });
      await audit(transaction, study.comparativaId, userId, {
        type: "plan_update",
        field: "plan",
        oldValue: JSON.stringify(plans),
        newValue: next,
        description: "Plan actualizado por el estudio Negoco Cloud",
      });
    }

    if (comparativa.company_id !== proposal.comercializadoraId) {
      await transaction.execute({
        sql: "UPDATE comparativas SET company_id = ? WHERE id = ?",
        args: [proposal.comercializadoraId, study.comparativaId],
      });
      await audit(transaction, study.comparativaId, userId, {
        type: "field_update",
        field: "company_id",
        oldValue: comparativa.company_id === null ? null : String(comparativa.company_id),
        newValue: proposal.comercializadoraId,
        description: `Comercializadora del estudio Negoco Cloud: ${proposal.comercializadoraName}`,
      });
    }

    if (comparativa.commission_segment === null) {
      await transaction.execute({
        sql: "UPDATE comparativas SET commission_segment = 'luz_20td', commission_segment_origin = 'tariff' WHERE id = ?",
        args: [study.comparativaId],
      });
    }

    // Como con Abarca: una comisión que ya estaba puesta no se pisa; la
    // revisión decide.
    if (proposal.commission !== null && comparativa.comision_fijo === null) {
      await transaction.execute({
        sql: "UPDATE comparativas SET comision_fijo = ? WHERE id = ?",
        args: [proposal.commission, study.comparativaId],
      });
      await audit(transaction, study.comparativaId, userId, {
        type: "commission_update",
        field: "comision_fijo",
        oldValue: null,
        newValue: proposal.commission,
        description: "Comisión de agencia (fijo) del estudio Negoco Cloud",
      });
    }

    await transaction.execute({
      sql: "UPDATE comparativas SET status = 'awaiting_review' WHERE id = ?",
      args: [study.comparativaId],
    });
    await audit(transaction, study.comparativaId, userId, {
      type: "status_change",
      field: "status",
      oldValue: String(comparativa.status),
      newValue: "awaiting_review",
      description: "Estudio Negoco Cloud completado: pendiente de revisión",
    });

    await transaction.execute({
      sql: "UPDATE comparison_study_proposals SET chosen_at = ?, comparativa_file_id = ? WHERE id = ?",
      args: [now, fileId, proposal.id],
    });
    await transaction.execute({
      sql: `UPDATE comparison_studies SET chosen_offer = ?, current_total = ?, chosen_total = ?,
          savings = ?, commission = ?
        WHERE id = ?`,
      args: [
        JSON.stringify({
          proposalId: proposal.id,
          number: proposal.number,
          key: proposal.offerKey,
          comercializadoraId: proposal.comercializadoraId,
          comercializadoraName: proposal.comercializadoraName,
          productName: proposal.productName,
          feeEnergyPerMwh: proposal.feeEnergyPerMwh,
        }),
        proposal.document.current?.cost.total ?? null,
        proposal.annualTotal,
        proposal.savings,
        proposal.commission,
        study.id,
      ],
    });
    await transaction.commit();
    return { fileId };
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    await stored.remove().catch((cause) => console.error("[comparador] orphan proposal PDF", cause));
    throw error;
  } finally {
    transaction.close();
  }
}
