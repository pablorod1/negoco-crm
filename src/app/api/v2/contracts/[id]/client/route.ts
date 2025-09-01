import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  updateClient,
  updateSigner,
  updateTramite,
} from "@/tramites/utils/updateTramiteHelpers";
import { addClient } from "@/tramites/utils/addTramiteHelpers";

// Zod validation schemas
const DocumentTypeSchema = z.enum(["DNI", "NIE", "CIF", "Otro", ""]);

const ClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().optional().default(""),
  email: z.string().email("Valid email is required"),
  type: z.string().min(1, "Client type is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  postal_code: z.string().optional().default(""),
  province: z.string().optional().default(""),
  city: z.string().optional().default(""),
  document_type: DocumentTypeSchema,
  document_number: z.string().min(1, "Document number is required"),
  IBAN: z.string().min(1, "IBAN is required"),
  coordinates: z
    .union([
      z.tuple([z.number(), z.number()]),
      z.string(),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .transform((val): [number, number] | null => {
      if (typeof val === "string" && val) {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) &&
            parsed.length === 2 &&
            typeof parsed[0] === "number" &&
            typeof parsed[1] === "number"
            ? [parsed[0], parsed[1]]
            : null;
        } catch {
          return null;
        }
      }
      return Array.isArray(val) &&
        val.length === 2 &&
        typeof val[0] === "number" &&
        typeof val[1] === "number"
        ? [val[0], val[1]]
        : null;
    }),
});

const SignerSchema = z
  .object({
    id: z.string().min(1, "Signer ID is required"),
    name: z.string().min(1, "Name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(1, "Phone is required"),
    document_number: z.string().min(1, "Document number is required"),
    cargo: z.string().nullable().optional(),
    client_id: z.string().min(1, "Client ID is required"),
  })
  .optional();

const UpdateClientRequestSchema = z.object({
  client: ClientSchema,
  signer: SignerSchema,
});

const CreateClientRequestSchema = z.object({
  client: ClientSchema,
  signer: SignerSchema,
});

// Response interfaces
interface ClientResponse {
  success: boolean;
  error?: string;
}

/**
 * POST /api/v2/contracts/[id]/client
 * Create a new client for a contract and associate it
 * Replaces: POST /api/v1/tramites/add/[id]/client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ClientResponse>> {
  try {
    const { id: tramite_id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateClientRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { client, signer } = validationResult.data;

    if (!tramite_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Contract ID is required",
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

    // Add client to database
    const clientData = {
      ...client,
      coordinates: client.coordinates || null,
    };
    const insertClientRes = await addClient(clientData, tursoClient);

    if (!insertClientRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: insertClientRes.error || "Error inserting client",
        },
        { status: 500 }
      );
    }

    // Update contract (tramite) with client ID
    const updateTramiteRes = await updateTramite(
      { client_id: client.id },
      tramite_id,
      tursoClient
    );

    if (!updateTramiteRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateTramiteRes.error || "Error updating contract",
        },
        { status: 500 }
      );
    }

    // Handle signer for business entities
    if (
      (client.type === "Empresa" ||
        client.type === "Comunidad de Propietarios") &&
      signer
    ) {
      const updateSignerRes = await updateSigner(
        { client_id: client.id },
        signer.id,
        tursoClient
      );

      if (!updateSignerRes.success) {
        return NextResponse.json(
          {
            success: false,
            error: updateSignerRes.error || "Error updating signer",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating client for contract:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error adding client to contract",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v2/contracts/[id]/client
 * Update client information for a contract
 * Replaces: PATCH /api/v1/tramites/update/client
 */
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<ClientResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateClientRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { client, signer } = validationResult.data;

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

    // Update client information
    const updateClientRes = await updateClient(client, client.id, tursoClient);

    if (!updateClientRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateClientRes.error || "Error updating client",
        },
        { status: 500 }
      );
    }

    // Update signer if provided and client is business entity
    if (
      signer &&
      (client.type === "Empresa" || client.type === "Comunidad de Propietarios")
    ) {
      const updateSignerRes = await updateSigner(
        signer,
        signer.id,
        tursoClient
      );

      if (!updateSignerRes.success) {
        return NextResponse.json(
          {
            success: false,
            error: updateSignerRes.error || "Error updating signer",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error updating client information",
      },
      { status: 500 }
    );
  }
}
