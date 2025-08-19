import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { updateContract } from "@/tramites/utils/updateTramiteHelpers";
import { addContracts } from "@/tramites/utils/addTramiteHelpers";

// Zod validation schemas
const ContractSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
  type: z.string().min(1, "Contract type is required"),
  province: z.string().min(1, "Province is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().min(1, "Address is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  old_company: z.string().optional(),
  new_company: z.string().min(1, "New company is required"),
  plan: z.string().min(1, "Plan is required"),
  consumption: z.number().min(0, "Consumption must be positive"),
  CUPS: z.string().min(1, "CUPS is required"),
  pot1: z.number().min(0, "Power values must be positive"),
  pot2: z.number().min(0, "Power values must be positive"),
  pot3: z.number().min(0, "Power values must be positive"),
  pot4: z.number().min(0, "Power values must be positive"),
  pot5: z.number().min(0, "Power values must be positive"),
  pot6: z.number().min(0, "Power values must be positive"),
  description: z.string().optional(),
  tramite_id: z.string().min(1, "Contract ID is required"),
});

const UpdateContractRequestSchema = z.object({
  contract: ContractSchema,
});

const CreateContractRequestSchema = z.object({
  contracts: z
    .array(ContractSchema)
    .min(1, "At least one contract is required"),
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
          error: `Validation error: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
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
          error: `Validation error: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { contract } = validationResult.data;

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
