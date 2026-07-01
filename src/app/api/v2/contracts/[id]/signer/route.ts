import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { updateSigner } from "@/tramites/utils/updateTramiteHelpers";
import { recordSignerChange } from "@/tramites/utils/tramiteChangesHelpers";

// Zod validation schemas
const SignerSchema = z.object({
  id: z.string().min(1, "Signer ID is required"),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  document_type: z.string().optional(),
  document_number: z.string().min(1, "Document number is required"),
  phone_prefix: z.string().optional().default("34"),
  cargo: z.string().nullable().optional(),
  client_id: z.string().min(1, "Client ID is required"),
});

const UpdateSignerRequestSchema = z.object({
  signer: SignerSchema,
  user_id: z.string().min(1, "User ID is required"), // Add user_id for tracking
});

// Response interfaces
interface SignerResponse {
  success: boolean;
  error?: string;
}

/**
 * PATCH /api/v2/contracts/[id]/signer
 * Update signer information for a contract
 * Replaces: PATCH /api/v1/tramites/update/signer
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SignerResponse>> {
  try {
    const { id: tramite_id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateSignerRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { signer, user_id } = validationResult.data;

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Get current signer data to track changes
    const currentSignerResult = await tursoClient.execute({
      sql: `SELECT * FROM signers WHERE id = ?`,
      args: [signer.id],
    });

    // Update signer information
    const updateResult = await updateSigner(signer, signer.id, tursoClient);

    if (!updateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateResult.error || "Error updating signer",
        },
        { status: 500 }
      );
    }

    // Track signer changes
    if (currentSignerResult.rows.length > 0) {
      const currentSigner = currentSignerResult.rows[0];
      const changes: Array<{
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }> = [];

      // Check each field for changes
      const signerFields = [
        "name",
        "last_name",
        "email",
        "phone",
        "document_type",
        "document_number",
        "phone_prefix",
        "cargo",
      ];

      for (const field of signerFields) {
        const oldValue = currentSigner[field] as string | null;
        const newValue = signer[field as keyof typeof signer] as string | null;

        if (oldValue !== newValue) {
          changes.push({
            field,
            oldValue,
            newValue,
          });
        }
      }

      if (changes.length > 0) {
        await recordSignerChange(tursoClient, tramite_id, user_id, changes);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating signer:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error actualizando firmante",
      },
      { status: 500 }
    );
  }
}
