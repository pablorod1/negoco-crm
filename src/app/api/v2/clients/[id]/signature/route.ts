import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { Row } from "@libsql/client";
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

/**
 * Retrieves the signature information for a specific client
 *
 * Migration from: /api/clients/get/[id]/signer
 * New endpoint: /new_api/clients/[id]/signature
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<SignatureResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<SignatureResponse>> {
  try {
    // Validate route parameters
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 },
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 },
      );
    }

    // Execute query to get signer information
    const result = await tursoClient.execute({
      sql: "SELECT * FROM signers WHERE client_id = ? LIMIT 1",
      args: [id],
    });

    // Handle no results found - EXACTLY match original behavior
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No signers found" },
        { status: 200 },
      );
    }

    // Return the first signer record
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
    // Validate route parameters
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 },
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 },
      );
    }

    // Execute query to get signer information
    const result = await tursoClient.execute({
      sql: "SELECT * FROM signers WHERE client_id = ? LIMIT 1",
      args: [id],
    });

    // Handle no results found - EXACTLY match original behavior
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No signers found" },
        { status: 200 },
      );
    }

    // Return the first signer record
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
});

const SignerUpdateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  document_number: z.string().min(1, "Document number is required"),
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
    if (!authResult.success) {
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

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json({ success: false, error: "Database not initialized" }, { status: 500 });
    }

    const clientResult = await tursoClient.execute({
      sql: "SELECT * FROM clients WHERE id = ?",
      args: [id],
    });

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });
    }

    const existingClient = clientResult.rows[0];

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

    if (signerUpdates && SIGNER_CLIENT_TYPES.includes(existingClient.type as string)) {
      const signerResult = await tursoClient.execute({
        sql: "SELECT * FROM signers WHERE client_id = ? LIMIT 1",
        args: [id],
      });

      if (signerResult.rows.length > 0) {
        const existingSigner = signerResult.rows[0];
        const setClauses: string[] = [];
        const args: (string | null)[] = [];

        const signerFields = ["name", "last_name", "email", "phone", "document_number", "cargo"] as const;
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
          sql: `INSERT INTO signers (id, name, last_name, email, phone, document_number, cargo, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            newSignerId,
            signerUpdates.name,
            signerUpdates.last_name,
            signerUpdates.email,
            signerUpdates.phone,
            signerUpdates.document_number,
            signerUpdates.cargo ?? null,
            id,
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
