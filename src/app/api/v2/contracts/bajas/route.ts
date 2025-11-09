import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";

// Simplified schemas for Baja creation - only required fields from the form
const BajaClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z.string().min(1, "Client name is required"),
  document_number: z.string().min(1, "Document number is required"),
  document_type: z.enum(["DNI", "NIE", "CIF", "Otro", ""]).default("DNI"),
});

const BajaTramiteSchema = z.object({
  id: z.string().min(1, "Tramite ID is required"),
  creation_date: z.string().min(1, "Creation date is required"),
  tramitation_date: z.string().optional().default(""),
  activation_date: z.string().optional().default(""),
  sales_name: z.string().min(1, "Sales name is required"),
  comision_sales_person: z.coerce.number().optional().default(0),
  comision: z.coerce.number().optional().default(0),
  status: z.literal("Baja"),
  liquidez_status: z.enum([
    "Pendiente de Cobro",
    "Cobrado por Comercializadora",
    "Pagado al Comercial",
    "Pendiente de Descontar",
    "Descontado",
  ]),
  client_id: z.string().min(1, "Client ID is required"),
  user_id: z.string().min(1, "User ID is required"),
});

const BajaContractSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
  CUPS: z.string().min(1, "CUPS is required"),
  tramite_id: z.string().min(1, "Tramite ID is required"),
  // Default values for other required fields
  type: z.string().default("Luz"),
  province: z.string().default(""),
  city: z.string().default(""),
  address: z.string().default(""),
  postal_code: z.string().default(""),
  new_company: z.string().default(""),
  plan: z.string().default(""),
});

interface BajaCreateResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    tramite_id: string;
    client_id: string;
  };
}

// A minimal interface for a DB executor (client or transaction)
type DBExecutor = Pick<Client, "execute">;

/**
 * Check if a client with minimal data exists
 */
const checkBajaClientExists = async (
  id: string,
  documentNumber: string,
  db: DBExecutor
): Promise<boolean> => {
  try {
    const res = await db.execute({
      sql: `SELECT id FROM clients WHERE id = ? AND document_number = ? LIMIT 1`,
      args: [id, documentNumber],
    });
    return res.rows.length > 0;
  } catch (error) {
    console.error("Error checking baja client existence:", error);
    return false;
  }
};

/**
 * Create a minimal client record for baja
 */
const createBajaClient = async (
  client: z.infer<typeof BajaClientSchema>,
  db: DBExecutor
): Promise<{ success: boolean; error?: string }> => {
  try {
    const clientExists = await checkBajaClientExists(
      client.id,
      client.document_number,
      db
    );

    if (clientExists) {
      return { success: true };
    }

    await db.execute({
      sql: `
        INSERT INTO clients (
          id, name, last_name, email, phone, address, document_number, 
          document_type, type, IBAN, postal_code, province, city
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        client.id,
        client.name,
        "", // last_name
        "", // default email for bajas
        "", // default phone
        "Sin dirección", // default address
        client.document_number,
        client.document_type,
        "Particular", // default type
        "ES", // default IBAN
        "", // postal_code
        "", // province
        "", // city
      ],
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating baja client:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Create tramite for baja
 */
const createBajaTramite = async (
  tramite: z.infer<typeof BajaTramiteSchema>,
  db: DBExecutor
): Promise<{ success: boolean; error?: string }> => {
  try {
    await db.execute({
      sql: `
        INSERT INTO tramites (
          id, creation_date, tramitation_date, activation_date, 
          sales_name, comision, comision_sales_person, status, liquidez_status,
          notes, internal_notes, client_id, user_id, renovation_date,
          collection_date, payment_date, provider, plan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        tramite.id,
        tramite.creation_date,
        tramite.tramitation_date || "",
        tramite.activation_date || "",
        tramite.sales_name,
        tramite.comision || 0,
        tramite.comision_sales_person || 0,
        tramite.status,
        tramite.liquidez_status,
        "[]", // empty notes
        "[]", // empty internal_notes
        tramite.client_id,
        tramite.user_id,
        "", // renovation_date
        null, // collection_date
        null, // payment_date
        null, // provider
        null, // plan
      ],
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating baja tramite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Create contract for baja
 */
const createBajaContract = async (
  contract: z.infer<typeof BajaContractSchema>,
  db: DBExecutor
): Promise<{ success: boolean; error?: string }> => {
  try {
    await db.execute({
      sql: `
        INSERT INTO contracts (
          id, type, province, city, address, postal_code, 
          old_company, new_company, plan, consumption, CUPS, 
          pot1, pot2, pot3, pot4, pot5, pot6, 
          description, tramite_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        contract.id,
        contract.type,
        contract.province,
        contract.city,
        contract.address,
        contract.postal_code,
        "", // old_company
        contract.new_company,
        contract.plan,
        0, // consumption
        contract.CUPS,
        0,
        0,
        0,
        0,
        0,
        0, // pot1-pot6
        "", // description
        contract.tramite_id,
      ],
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating baja contract:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * POST endpoint for creating bajas (cancellations)
 * Simplified version that only requires minimal client data
 *
 * @param request - Next.js request object containing form data
 * @returns Promise<NextResponse<BajaCreateResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<BajaCreateResponse>> {
  try {
    // Initialize database connection
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed",
        },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();

    const tramiteString = formData.get("tramite") as string;
    const clientString = formData.get("client") as string;
    const contractsString = formData.get("contracts") as string;
    const userDataString = formData.get("userData") as string;

    // Validate required fields
    if (
      !tramiteString ||
      !clientString ||
      !contractsString ||
      !userDataString
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters",
        },
        { status: 400 }
      );
    }

    // Parse and validate data with simplified schemas
    let tramite: z.infer<typeof BajaTramiteSchema>;
    let client: z.infer<typeof BajaClientSchema>;
    let contracts: z.infer<typeof BajaContractSchema>[];

    try {
      const tramiteData = JSON.parse(tramiteString);
      const clientData = JSON.parse(clientString);
      const contractsData = JSON.parse(contractsString);

      // Validate with Zod
      tramite = BajaTramiteSchema.parse(tramiteData);
      client = BajaClientSchema.parse(clientData);
      contracts = z.array(BajaContractSchema).parse(contractsData);

      // Ensure consistency
      if (!tramite.client_id || tramite.client_id.trim() === "") {
        tramite.client_id = client.id;
      }

      if (tramite.client_id !== client.id) {
        console.warn(
          `[BAJA] Client ID mismatch. Using client.id: ${client.id}`
        );
        tramite.client_id = client.id;
      }

      // Set tramite_id in contracts
      contracts = contracts.map((contract) => ({
        ...contract,
        tramite_id: tramite.id,
      }));
    } catch (validationError) {
      console.error("[BAJA] Validation error:", validationError);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid data format for baja",
        },
        { status: 400 }
      );
    }

    // Start transaction
    const tx = await tursoClient.transaction();

    try {
      // 1. Create or verify client
      const clientResult = await createBajaClient(client, tx);
      if (!clientResult.success) {
        await tx.rollback();
        return NextResponse.json(
          {
            success: false,
            error: `Error creating client: ${clientResult.error}`,
          },
          { status: 500 }
        );
      }

      // 2. Create tramite
      const tramiteResult = await createBajaTramite(tramite, tx);
      if (!tramiteResult.success) {
        await tx.rollback();
        return NextResponse.json(
          {
            success: false,
            error: `Error creating tramite: ${tramiteResult.error}`,
          },
          { status: 500 }
        );
      }

      // 3. Create contracts
      for (const contract of contracts) {
        const contractResult = await createBajaContract(contract, tx);
        if (!contractResult.success) {
          await tx.rollback();
          return NextResponse.json(
            {
              success: false,
              error: `Error creating contract: ${contractResult.error}`,
            },
            { status: 500 }
          );
        }
      }

      // Commit transaction
      await tx.commit();

      return NextResponse.json(
        {
          success: true,
          message: "Baja created successfully",
          data: {
            tramite_id: tramite.id,
            client_id: client.id,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    console.error("[BAJA] Error creating baja:", error);

    const message =
      error instanceof Error ? error.message : "Error al crear la baja";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
