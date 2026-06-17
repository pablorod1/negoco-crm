import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  updateClient,
  updateSigner,
  updateTramite,
} from "@/tramites/utils/updateTramiteHelpers";
import { addClient } from "@/tramites/utils/addTramiteHelpers";
import {
  recordClientChange,
  recordSignerChange,
} from "@/tramites/utils/tramiteChangesHelpers";

// Zod validation schemas
const DocumentTypeSchema = z.enum(["DNI", "NIE", "CIF", "Otro", ""]);

const ClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().optional().default(""),
  email: z.email("Valid email is required"),
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

const SignerSchema = z.object({
  id: z.string().min(1, "Signer ID is required"),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  document_number: z.string().min(1, "Document number is required"),
  cargo: z.string().nullable().optional(),
  client_id: z.string().min(1, "Client ID is required"),
});

const clientRequiresSigner = (clientType: string) =>
  clientType === "Empresa" || clientType === "Comunidad de Propietarios";

const validateSignerForClient = (clientType: string, signer: unknown) => {
  if (!clientRequiresSigner(clientType)) {
    return { success: true as const, signer: undefined };
  }

  const signerValidationResult = SignerSchema.safeParse(signer);

  if (!signerValidationResult.success) {
    return {
      success: false as const,
      issues: signerValidationResult.error.issues,
    };
  }

  return { success: true as const, signer: signerValidationResult.data };
};

const UpdateClientRequestSchema = z.object({
  client: ClientSchema,
  signer: z.unknown().optional(),
  user_id: z.string().min(1, "User ID is required"), // Add user_id for tracking
});

const CreateClientRequestSchema = z.object({
  client: ClientSchema,
  signer: z.unknown().optional(),
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
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ClientResponse>> {
  try {
    const { id: tramite_id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateClientRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(
        "Validation error creating client:",
        validationResult.error.issues,
      );
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.join("; ")}`,
        },
        { status: 400 },
      );
    }

    const { client } = validationResult.data;
    const signerValidationResult = validateSignerForClient(
      client.type,
      validationResult.data.signer,
    );

    if (!signerValidationResult.success) {
      console.error(
        "Validation error creating client signer:",
        signerValidationResult.issues,
      );
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${signerValidationResult.issues.map((issue) => issue.message).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const { signer } = signerValidationResult;

    if (!tramite_id) {
      console.error("Contract ID is required to add client");
      return NextResponse.json(
        {
          success: false,
          error: "Contract ID is required",
        },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 },
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
        { status: 500 },
      );
    }

    // Update contract (tramite) with client ID
    const updateTramiteRes = await updateTramite(
      { client_id: client.id },
      tramite_id,
      tursoClient,
    );

    if (!updateTramiteRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateTramiteRes.error || "Error updating contract",
        },
        { status: 500 },
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
        tursoClient,
      );

      if (!updateSignerRes.success) {
        return NextResponse.json(
          {
            success: false,
            error: updateSignerRes.error || "Error updating signer",
          },
          { status: 500 },
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
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v2/contracts/[id]/client
 * Update client information for a contract
 * Replaces: PATCH /api/v1/tramites/update/client
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ClientResponse>> {
  try {
    const { id: tramite_id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateClientRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const { client, user_id } = validationResult.data;
    const signerValidationResult = validateSignerForClient(
      client.type,
      validationResult.data.signer,
    );

    if (!signerValidationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${signerValidationResult.issues.map((issue) => issue.message).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const { signer } = signerValidationResult;

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 },
      );
    }

    // Get current client and signer data to track changes
    const currentClientResult = await tursoClient.execute({
      sql: `SELECT * FROM clients WHERE id = ?`,
      args: [client.id],
    });

    const currentSignerResult = signer
      ? await tursoClient.execute({
          sql: `SELECT * FROM signers WHERE id = ?`,
          args: [signer.id],
        })
      : null;

    // Update client information
    const updateClientRes = await updateClient(client, client.id, tursoClient);

    if (!updateClientRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateClientRes.error || "Error updating client",
        },
        { status: 500 },
      );
    }

    // Track client changes
    if (currentClientResult.rows.length > 0) {
      const currentClient = currentClientResult.rows[0];
      const changes: Array<{
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }> = [];

      // Check each field for changes
      const clientFields = [
        "name",
        "last_name",
        "email",
        "phone",
        "address",
        "postal_code",
        "province",
        "city",
        "document_number",
        "document_type",
        "IBAN",
        "type",
      ];

      for (const field of clientFields) {
        const oldValue = currentClient[field] as string | null;
        const newValue = client[field as keyof typeof client] as string | null;

        if (oldValue !== newValue) {
          changes.push({
            field,
            oldValue,
            newValue,
          });
        }
      }

      if (changes.length > 0) {
        await recordClientChange(tursoClient, tramite_id, user_id, changes);
      }
    }

    // Update signer if provided and client is business entity
    if (
      signer &&
      (client.type === "Empresa" || client.type === "Comunidad de Propietarios")
    ) {
      const updateSignerRes = await updateSigner(
        signer,
        signer.id,
        tursoClient,
      );

      if (!updateSignerRes.success) {
        return NextResponse.json(
          {
            success: false,
            error: updateSignerRes.error || "Error updating signer",
          },
          { status: 500 },
        );
      }

      // Track signer changes
      if (currentSignerResult && currentSignerResult.rows.length > 0) {
        const currentSigner = currentSignerResult.rows[0];
        const signerChanges: Array<{
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
          "document_number",
          "document_type",
        ];

        for (const field of signerFields) {
          const oldValue = currentSigner[field] as string | null;
          const newValue = signer[field as keyof typeof signer] as
            | string
            | null;

          if (oldValue !== newValue) {
            signerChanges.push({
              field,
              oldValue,
              newValue,
            });
          }
        }

        if (signerChanges.length > 0) {
          await recordSignerChange(
            tursoClient,
            tramite_id,
            user_id,
            signerChanges,
          );
        }
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
      { status: 500 },
    );
  }
}
