import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { updateContract } from "@/tramites/utils/updateTramiteHelpers";
import { addContracts } from "@/tramites/utils/addTramiteHelpers";
import { recordContractChange } from "@/tramites/utils/tramiteChangesHelpers";

// Zod validation schemas
const optionalNumericField = z.preprocess(
  (val) => {
    // Treat empty values as 0 for numeric fields
    if (val === undefined || val === null || val === "") return 0;
    // Normalize strings, allowing comma decimal separators
    if (typeof val === "string") {
      const normalized = val.replace(",", ".");
      const num = Number(normalized);
      return Number.isFinite(num) ? num : 0; // Default to 0 if not a valid number
    }
    return val;
  },
  z.number().min(0, "Values must be positive")
);

const ContractSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
  type: z.string().min(1, "Contract type is required"),
  province: z.string().min(1, "Province is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().min(1, "Address is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  // Support both legacy string fields and new ID-based fields
  old_company: z.string().optional(),
  new_company: z.string().optional(), // Made optional when using IDs
  plan: z.string().min(1, "Plan is required"),
  consumption: optionalNumericField,
  CUPS: z.string().min(1, "CUPS is required"),
  pot1: optionalNumericField,
  pot2: optionalNumericField,
  pot3: optionalNumericField,
  pot4: optionalNumericField,
  pot5: optionalNumericField,
  pot6: optionalNumericField,
  description: z.string().optional(),
  tramite_id: z.string().min(1, "Contract ID is required"),
});

const UpdateContractRequestSchema = z.object({
  contract: ContractSchema,
  user_id: z.string().optional(), // For change tracking
});

const CreateContractRequestSchema = z.object({
  contracts: z
    .array(ContractSchema)
    .min(1, "At least one contract is required"),
  user_id: z.string().optional(), // For change tracking
});

// Response interfaces
interface ContractResponse {
  success: boolean;
  error?: string;
}

/**
 * POST /api/v2/contracts/[id]/contract
 * Create new contracts for a tramite
 * Replaces: POST /api/v1/tramites/add/[id]/contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContractResponse>> {
  try {
    const { id: tramite_id } = await params;
    const formData = await request.formData();

    const contractsString = formData.get("contracts") as string;
    const userIdString = formData.get("user_id") as string; // Get user_id for tracking

    if (!contractsString || !tramite_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters: contracts and tramite ID are required",
        },
        { status: 400 }
      );
    }

    let contracts;
    try {
      contracts = JSON.parse(contractsString);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON format for contracts",
        },
        { status: 400 }
      );
    }

    // Validate contracts data
    const validationResult = CreateContractRequestSchema.safeParse({
      contracts,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

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

    // Add contracts to database
    if (contracts && contracts.length > 0) {
      const contractsResult = await addContracts(contracts, tursoClient);
      if (!contractsResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: contractsResult.error || "Error adding contracts",
          },
          { status: 500 }
        );
      }

      // ==================== TRACK CONTRACT CREATION ====================

      // Track contract creation if user_id is provided
      if (userIdString) {
        for (const contract of contracts) {
          await recordContractChange(
            tursoClient,
            tramite_id,
            userIdString,
            "created",
            {
              newContract: contract as Record<string, unknown>,
              contractId: contract.id,
            }
          );
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating contracts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al agregar el contrato",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v2/contracts/[id]/contract
 * Update contract information
 * Replaces: PATCH /api/v1/tramites/update/contract
 */
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<ContractResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateContractRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { contract, user_id } = validationResult.data;

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

    // Get the current contract before updating (for tracking changes)
    let oldContract = null;
    if (user_id) {
      try {
        const currentContractResult = await tursoClient.execute({
          sql: "SELECT * FROM contracts WHERE id = ?",
          args: [contract.id],
        });

        if (currentContractResult.rows.length > 0) {
          oldContract = currentContractResult.rows[0];
        }
      } catch (error) {
        console.error("Error fetching current contract for tracking:", error);
        // Continue with update even if we can't track changes
      }
    }

    // Update contract information
    const updateResult = await updateContract(
      contract,
      contract.id,
      tursoClient
    );

    if (!updateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateResult.error || "Error updating contract",
        },
        { status: 500 }
      );
    }

    // ==================== TRACK CONTRACT UPDATE ====================

    // Track contract update if user_id is provided
    if (user_id && oldContract) {
      await recordContractChange(
        tursoClient,
        contract.tramite_id,
        user_id,
        "updated",
        {
          oldContract: oldContract as Record<string, unknown>,
          newContract: contract as Record<string, unknown>,
          contractId: contract.id,
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error actualizando tramite",
      },
      { status: 500 }
    );
  }
}
