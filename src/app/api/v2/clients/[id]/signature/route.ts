import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import type { Client, Row } from "@libsql/client";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import crypto from "crypto";

// Response Types
interface SignatureResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: Row;
}

async function getAccessibleClient(
  tursoClient: Client,
  clientId: string,
  user: { id: string; role: string },
) {
  const args: string[] = [clientId];
  let sql = "SELECT clients.* FROM clients WHERE clients.id = ?";

  if (user.role === "2") {
    const subcomerciales = await getSubcomerciales(tursoClient, user.id);
    const allowedUserIds = [user.id];

    if (subcomerciales.success && subcomerciales.ids.length > 0) {
      allowedUserIds.push(...subcomerciales.ids);
    }

    sql = `
      SELECT DISTINCT clients.*
      FROM clients
      JOIN tramites ON tramites.client_id = clients.id
      WHERE clients.id = ?
        AND tramites.user_id IN (${allowedUserIds.map(() => "?").join(", ")})
    `;
    args.push(...allowedUserIds);
  }

  const result = await tursoClient.execute({ sql, args });
  return result.rows[0] ?? null;
}

/**
 * RESTful GET method for retrieving signature information
 * Provides the same functionality as POST but follows REST conventions
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<SignatureResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<SignatureResponse>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request) as Client | null;

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 },
      );
    }

    const client = await getAccessibleClient(tursoClient, id, authResult.user);
    if (!client) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await tursoClient.execute({
      sql: "SELECT * FROM signers WHERE client_id = ? LIMIT 1",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No signers found" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching signature:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
      },
      { status: 500 },
    );
  }
}

const ClientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  type: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  IBAN: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  tipo_via_cnmc: z.string().nullable().optional(),
  calle: z.string().nullable().optional(),
  numero_finca: z.string().nullable().optional(),
  aclarador_finca: z.string().nullable().optional(),
  phone_prefix: z.string().optional(),
  cnae: z.string().nullable().optional(),
});

const SignerUpdateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  document_type: z.string().optional(),
  document_number: z.string().min(1, "Document number is required"),
  phone_prefix: z.string().optional(),
  cargo: z.string().nullable().optional(),
});

const PatchSignatureSchema = z.object({
  client: ClientUpdateSchema.optional(),
  signer: SignerUpdateSchema.optional(),
});

interface PatchSignatureResponse {
  success: boolean;
  error?: string;
}

const SIGNER_CLIENT_TYPES = ["Empresa", "Comunidad de Propietarios"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<PatchSignatureResponse>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing client ID" }, { status: 400 });
    }

    const body = await request.json();
    const validation = PatchSignatureSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const { client: clientUpdates, signer: signerUpdates } = validation.data;

    const tursoClient = getTursoClient(request) as Client | null;
    if (!tursoClient) {
      return NextResponse.json({ success: false, error: "Database not initialized" }, { status: 500 });
    }

    const existingClient = await getAccessibleClient(tursoClient, id, authResult.user);
    if (!existingClient) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (signerUpdates && !SIGNER_CLIENT_TYPES.includes(existingClient.type as string)) {
      return NextResponse.json(
        { success: false, error: "Este tipo de cliente no requiere firmante" },
        { status: 400 },
      );
    }

    if (clientUpdates && Object.keys(clientUpdates).length > 0) {
      const setClauses: string[] = [];
      const args: (string | null)[] = [];

      for (const [key, value] of Object.entries(clientUpdates)) {
        if (value !== undefined) {
          setClauses.push(`${key} = ?`);
          args.push(value as string);
        }
      }

      if (setClauses.length > 0) {
        args.push(id);
        await tursoClient.execute({
          sql: `UPDATE clients SET ${setClauses.join(", ")} WHERE id = ?`,
          args,
        });
      }
    }

    if (signerUpdates) {
      const signerResult = await tursoClient.execute({
        sql: "SELECT * FROM signers WHERE client_id = ? LIMIT 1",
        args: [id],
      });

      if (signerResult.rows.length > 0) {
        const existingSigner = signerResult.rows[0];
        const setClauses: string[] = [];
        const args: (string | null)[] = [];

        const signerFields = [
          "name",
          "last_name",
          "email",
          "phone",
          "document_type",
          "document_number",
          "phone_prefix",
          "cargo",
        ] as const;
        for (const field of signerFields) {
          const value = signerUpdates[field];
          if (value !== undefined) {
            setClauses.push(`${field} = ?`);
            args.push(value as string | null);
          }
        }

        if (setClauses.length > 0) {
          args.push(existingSigner.id as string);
          await tursoClient.execute({
            sql: `UPDATE signers SET ${setClauses.join(", ")} WHERE id = ?`,
            args,
          });
        }
      } else {
        const newSignerId = crypto.randomUUID();
        await tursoClient.execute({
          sql: `INSERT INTO signers (
                  id, name, last_name, email, phone, document_number, cargo,
                  client_id, document_type, phone_prefix
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            newSignerId,
            signerUpdates.name,
            signerUpdates.last_name,
            signerUpdates.email,
            signerUpdates.phone,
            signerUpdates.document_number,
            signerUpdates.cargo ?? null,
            id,
            signerUpdates.document_type ?? null,
            signerUpdates.phone_prefix ?? "34",
          ],
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating signature:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
