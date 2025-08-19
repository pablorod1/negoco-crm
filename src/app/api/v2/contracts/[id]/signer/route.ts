import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { updateSigner } from "@/tramites/utils/updateTramiteHelpers";

// Zod validation schemas
const SignerSchema = z.object({
  id: z.string().min(1, "Signer ID is required"),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  document_number: z.string().min(1, "Document number is required"),
  cargo: z.string().nullable().optional(),
  client_id: z.string().min(1, "Client ID is required"),
});

const UpdateSignerRequestSchema = z.object({
  signer: SignerSchema,
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
  request: NextRequest
): Promise<NextResponse<SignerResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateSignerRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { signer } = validationResult.data;

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
