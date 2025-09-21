import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";
import { recordFieldChanges } from "@/tramites/utils/tramiteChangesHelpers";

/**
 * PROVIDER UPDATE ENDPOINT
 *
 * Endpoint: /api/v2/contracts/[id]/provider
 *
 * This endpoint updates the provider field for a contract (tramite)
 * with enhanced performance, type safety, and comprehensive error handling.
 */

// ==================== TYPE DEFINITIONS ====================

interface ProviderUpdateResponse {
  success: boolean;
  error?: string;
}

// ==================== VALIDATION SCHEMAS ====================

/**
 * Zod schema for provider update request body
 * Allows empty string to clear the provider
 */
const ProviderUpdateSchema = z.object({
  provider: z.string().optional().default(""),
  user_id: z.string().optional(), // For change tracking
});

/**
 * Zod schema for contract ID parameter validation
 */
const ContractIdSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
});

// ==================== HELPER FUNCTIONS ====================

// (Removed executeQueryWithMetrics for simplicity)

// ==================== MAIN HANDLER ====================

/**
 * PATCH /api/v2/contracts/[id]/provider
 *
 * Updates the provider for a contract
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing contract ID
 * @returns Promise<NextResponse<ProviderUpdateResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ProviderUpdateResponse>> {
  try {
    // ==================== PARAMETER VALIDATION ====================

    const resolvedParams = await params;
    const paramValidation = ContractIdSchema.safeParse(resolvedParams);

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid contract ID parameter",
        },
        { status: 400 }
      );
    }

    const { id: contractId } = paramValidation.data;

    // ==================== REQUEST BODY VALIDATION ====================

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    const bodyValidation = ProviderUpdateSchema.safeParse(requestBody);

    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid provider format",
        },
        { status: 400 }
      );
    }

    const { provider, user_id } = bodyValidation.data;

    // ==================== DATABASE CLIENT INITIALIZATION ====================

    let tursoClient: Client;
    try {
      tursoClient = getTursoClient(request);
    } catch (error) {
      console.error("Database client initialization failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // ==================== GET CURRENT PROVIDER VALUE ====================

    let currentProvider: string | null = null;
    if (user_id) {
      try {
        const currentResult = await tursoClient.execute({
          sql: "SELECT provider FROM tramites WHERE id = ?",
          args: [contractId],
        });

        if (currentResult.rows.length > 0) {
          currentProvider = currentResult.rows[0].provider as string | null;
        }
      } catch (error) {
        console.error("Error fetching current provider:", error);
        // Continue without tracking if we can't get current value
      }
    }

    // ==================== DATABASE UPDATE OPERATION ====================

    // Convert empty string to null for database storage
    const providerValue = provider.trim() === "" ? null : provider.trim();
    const updateQuery = `UPDATE tramites SET provider = ? WHERE id = ?`;
    const updateArgs = [providerValue, contractId];

    let result;
    try {
      result = await tursoClient.execute({
        sql: updateQuery,
        args: updateArgs,
      });
    } catch (error) {
      console.error("Database update failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Database update failed",
        },
        { status: 500 }
      );
    }

    // ==================== RESPONSE HANDLING ====================

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Contract not found or no changes made",
        },
        { status: 404 }
      );
    }

    // ==================== TRACK PROVIDER CHANGE ====================

    // Track provider change if user_id is provided
    if (user_id && currentProvider !== providerValue) {
      await recordFieldChanges(tursoClient, contractId, user_id, [
        {
          field_name: "provider",
          old_value: currentProvider,
          new_value: providerValue,
          description: "Proveedor actualizado",
        },
      ]);
    }

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Provider update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
