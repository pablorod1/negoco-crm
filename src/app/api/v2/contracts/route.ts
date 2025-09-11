import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/tramites/types/tramite.types";
import { Client } from "@libsql/client";
import { recordTramiteCreation } from "@/tramites/utils/tramiteChangesHelpers";

// Zod Validation Schemas
const StatusSchema = z.enum([
  "Borrador",
  "Tramitable",
  "Verificado",
  "Pendiente de Firma",
  "Procesando",
  "Activo",
  "Baja",
  "Scoring",
  "Incidencia",
  "KO",
]);

const LiquidezStatusSchema = z
  .enum([
    "Pendiente de Cobro",
    "Cobrado por Comercializadora",
    "Pagado al Comercial",
    "Pendiente de Descontar",
    "Descontado",
  ])
  .nullable();

const DocumentTypeSchema = z.enum(["DNI", "NIE", "CIF", "Otro", ""]);

// Pagination-specific schemas
const DateRangeSchema = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
  })
  .optional();

const PaginatedContractsRequestSchema = z.object({
  page: z.number().min(1, "Page must be at least 1"),
  rowsPerPage: z.union([z.number().min(1), z.literal("Sin Límite")]),
  user_id: z.string().min(1, "User ID is required"),
  user_role: z.string().min(1, "User role is required"),
  filterValue: z.string().optional(),
  companyFilter: z.array(z.string()).optional(),
  statusFilter: z.array(z.string()).optional(),
  liquidezStatusFilter: z.array(z.string()).optional(),
  contractTypeFilter: z.array(z.string()).optional(),
  activationDateRange: DateRangeSchema,
  creationDateRange: DateRangeSchema,
  renovationDateRange: DateRangeSchema,
  collectionDateRange: DateRangeSchema,
  paymentDateRange: DateRangeSchema,
  userFilter: z.array(z.string()).optional(),
  clientFilter: z.string().optional(),
  providerFilter: z.array(z.string()).optional(),
});

const TramiteSchema = z.object({
  id: z.string().min(1, "Tramite ID is required"),
  creation_date: z.string().min(1, "Creation date is required"),
  tramitation_date: z.string().optional().default(""),
  activation_date: z.string().optional().default(""),
  renovation_date: z.string().optional().default(""),
  collection_date: z.string().nullable().optional(),
  payment_date: z.string().nullable().optional(),
  sales_name: z.string().min(1, "Sales name is required"),
  comision_sales_person: z.coerce.number().optional().default(0),
  comision: z.coerce.number().optional().default(0),
  status: StatusSchema,
  liquidez_status: LiquidezStatusSchema,
  notes: z
    .union([
      z.array(z.string()),
      z.string().transform((str, ctx) => {
        if (str === "" || str === "[]") return [];
        try {
          const parsed = JSON.parse(str);
          if (
            Array.isArray(parsed) &&
            parsed.every((item) => typeof item === "string")
          ) {
            return parsed as string[];
          }
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid notes format - must be array of strings",
          });
          return z.NEVER;
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid JSON in notes",
          });
          return z.NEVER;
        }
      }),
    ])
    .default([]),
  internal_notes: z
    .union([
      z.array(z.string()),
      z.string().transform((str, ctx) => {
        if (str === "" || str === "[]") return [];
        try {
          const parsed = JSON.parse(str);
          if (
            Array.isArray(parsed) &&
            parsed.every((item) => typeof item === "string")
          ) {
            return parsed as string[];
          }
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid internal_notes format - must be array of strings",
          });
          return z.NEVER;
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid JSON in internal_notes",
          });
          return z.NEVER;
        }
      }),
    ])
    .default([]),
  client_id: z
    .string()
    .optional()
    .default("")
    .transform((val, ctx) => {
      // Allow empty string temporarily - will be fixed after client validation
      if (!val || val.trim() === "") {
        return "";
      }
      if (val.length < 1) {
        ctx.addIssue({
          code: "too_small",
          minimum: 1,
          type: "string",
          inclusive: true,
          message: "Client ID is required",
        });
        return z.NEVER;
      }
      return val;
    }),
  user_id: z.string().min(1, "User ID is required"),
  rejected_date: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
});

const ClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z.string().min(1, "Client name is required"),
  last_name: z.string().optional().default(""),
  email: z.string().email("Invalid email format"),
  type: z.string().min(1, "Client type is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  postal_code: z.string().default(""),
  province: z.string().default(""),
  city: z.string().default(""),
  document_type: DocumentTypeSchema,
  document_number: z.string().min(1, "Document number is required"),
  IBAN: z.string().min(1, "IBAN is required"),
  coordinates: z
    .union([
      z.tuple([z.number(), z.number()]),
      z.string().transform((str, ctx) => {
        if (str === "" || str === "null" || str === "undefined") return null;
        try {
          const parsed = JSON.parse(str);
          if (
            Array.isArray(parsed) &&
            parsed.length === 2 &&
            typeof parsed[0] === "number" &&
            typeof parsed[1] === "number"
          ) {
            return parsed as [number, number];
          }
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid coordinates format",
          });
          return z.NEVER;
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid JSON in coordinates",
          });
          return z.NEVER;
        }
      }),
      z.undefined(),
      z.null(),
    ])
    .nullable()
    .optional()
    .default(null),
});

const ContractSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
  type: z.string().min(1, "Contract type is required"),
  province: z.string().min(1, "Province is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().min(1, "Address is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  // Support both legacy string fields and new ID-based fields
  old_company: z.string().optional(),
  new_company: z.string().min(1, "New company is required"),
  plan: z.string().min(1, "Plan is required"),
  consumption: z.coerce.number().optional().default(0),
  CUPS: z.string().min(1, "CUPS is required"),
  pot1: z.coerce.number().optional().default(0),
  pot2: z.coerce.number().optional().default(0),
  pot3: z.coerce.number().optional().default(0),
  pot4: z.coerce.number().optional().default(0),
  pot5: z.coerce.number().optional().default(0),
  pot6: z.coerce.number().optional().default(0),
  description: z.string().default(""),
  tramite_id: z.string().min(1, "Tramite ID is required"),
});

const SignerSchema = z
  .object({
    id: z.string().min(1, "Signer ID is required"),
    name: z.string().min(1, "Signer name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().min(1, "Phone is required"),
    document_number: z.string().min(1, "Document number is required"),
    cargo: z.string().nullable(),
    client_id: z
      .string()
      .optional()
      .default("")
      .transform((val, ctx) => {
        // Allow empty string temporarily - will be fixed after client validation
        if (!val || val.trim() === "") {
          return "";
        }
        if (val.length < 1) {
          ctx.addIssue({
            code: "too_small",
            minimum: 1,
            type: "string",
            inclusive: true,
            message: "Client ID is required",
          });
          return z.NEVER;
        }
        return val;
      }),
  })
  .nullable();

const TramiteFileSchema = z.object({
  id: z.string().min(1, "File ID is required"),
  tramite_id: z.string().min(1, "Tramite ID is required"),
  filename: z.string().min(1, "Filename is required"),
  size: z.coerce.number().min(0, "File size must be positive"),
  extension: z.string().min(1, "Extension is required"),
  upload_date: z.string().min(1, "Upload date is required"),
  download_url: z.string().url("Invalid download URL"),
  preview_url: z.string().url("Invalid preview URL").nullable(),
});

const UserSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "User name is required"),
  email: z.string().email("Invalid email format"),
  role: z.string().min(1, "User role is required"),
  image: z.string().nullable().optional().default(null),
});

// Simple user data type for this endpoint
type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
};

// Request/Response Types
interface ContractCreateResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    tramite_id: string;
    client_id: string;
    contracts_count: number;
    files_count: number;
  };
}

// Pagination Response Types
interface ContractData {
  id: string;
  creation_date: string;
  activation_date: string;
  renovation_date: string;
  collection_date: string | null;
  payment_date: string | null;
  sales_name: string;
  client_name: string;
  client_email: string;
  client_id: string;
  CUPS: string[];
  new_company: string[];
  old_company: string[];
  plan: string[];
  contract_type: string[];
  consumption: number[];
  comision_sales_person: number;
  comision: number;
  status: string;
  liquidez_status: string;
  provider: string | null;
}

interface PaginatedContractsResponse {
  success: boolean;
  data?: ContractData[];
  total?: number;
  error?: string;
}

interface QueryMetrics {
  queryTime: number;
  operationsCompleted: number;
  transactionTime: number;
  geocodeTime?: number;
}

// A minimal interface for a DB executor (client or transaction)
type DBExecutor = Pick<Client, "execute">;

// Optimized helper functions with performance improvements
const checkClientExists = async (
  id: string,
  documentNumber: string,
  db: DBExecutor
): Promise<boolean> => {
  try {
    const startTime = performance.now();
    const res = await db.execute({
      sql: `SELECT id FROM clients WHERE id = ? AND document_number = ? LIMIT 1`,
      args: [id, documentNumber],
    });
    const queryTime = performance.now() - startTime;

    console.log(
      `[PERFORMANCE] Client existence check: ${queryTime.toFixed(2)}ms`
    );
    return res.rows.length > 0;
  } catch (error) {
    console.error("Error checking client existence:", error);
    return false;
  }
};

const checkSignerExists = async (
  id: string,
  db: DBExecutor
): Promise<boolean> => {
  try {
    const startTime = performance.now();
    const res = await db.execute({
      sql: `SELECT id FROM signers WHERE id = ? LIMIT 1`,
      args: [id],
    });
    const queryTime = performance.now() - startTime;

    console.log(
      `[PERFORMANCE] Signer existence check: ${queryTime.toFixed(2)}ms`
    );
    return res.rows.length > 0;
  } catch (error) {
    console.error("Error checking signer existence:", error);
    return false;
  }
};

const geocodeAddress = async (
  address: string,
  postalCode: string,
  province: string
): Promise<[number, number] | null> => {
  try {
    const startTime = performance.now();
    const fullAddress = `${address}, ${postalCode}, ${province}, España`;
    const openCageKey = process.env.GEOCODE_API_KEY;

    if (!openCageKey) {
      console.warn("Geocoding API key not configured");
      return null;
    }

    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        fullAddress
      )}&key=${openCageKey}&limit=1`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();
    const geocodeTime = performance.now() - startTime;

    console.log(`[PERFORMANCE] Geocoding: ${geocodeTime.toFixed(2)}ms`);

    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return [lat, lng];
    }

    return null;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
};

const addClientOptimized = async (
  client: ClientDB,
  db: DBExecutor,
  precomputedCoordinates: [number, number] | null
): Promise<{ success: boolean; error?: string }> => {
  try {
    const clientExists = await checkClientExists(
      client.id,
      client.document_number,
      db
    );

    if (clientExists) {
      return { success: true };
    }

    const startTime = performance.now();
    await db.execute({
      sql: `
        INSERT INTO clients (
          id, name, last_name, email, phone, address, document_number, 
          document_type, type, IBAN, postal_code, province, city, coordinates
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        client.id,
        client.name,
        client.last_name || "",
        client.email,
        client.phone,
        client.address,
        client.document_number,
        client.document_type,
        client.type,
        client.IBAN,
        client.postal_code,
        client.province,
        client.city,
        precomputedCoordinates ? JSON.stringify(precomputedCoordinates) : null,
      ],
    });

    const queryTime = performance.now() - startTime;
    console.log(`[PERFORMANCE] Client insert: ${queryTime.toFixed(2)}ms`);

    return { success: true };
  } catch (error) {
    console.error("Error adding client:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const addSignerOptimized = async (
  signer: SignerDB,
  db: DBExecutor
): Promise<{ success: boolean; error?: string }> => {
  try {
    const signerExists = await checkSignerExists(signer.id, db);

    if (signerExists) {
      return { success: true };
    }

    const startTime = performance.now();
    await db.execute({
      sql: `
        INSERT INTO signers (
          id, name, last_name, email, phone, document_number, cargo, client_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        signer.id,
        signer.name,
        signer.last_name || "",
        signer.email,
        signer.phone,
        signer.document_number,
        signer.cargo,
        signer.client_id,
      ],
    });

    const queryTime = performance.now() - startTime;
    console.log(`[PERFORMANCE] Signer insert: ${queryTime.toFixed(2)}ms`);

    return { success: true };
  } catch (error) {
    console.error("Error adding signer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const addTramiteOptimized = async (
  tramite: TramiteDB,
  db: DBExecutor
): Promise<{ success: boolean; error?: string }> => {
  try {
    const startTime = performance.now();
    await db.execute({
      sql: `
        INSERT INTO tramites (
          id, creation_date, tramitation_date, activation_date, renovation_date,
          sales_name, comision, comision_sales_person, status, liquidez_status,
          notes, internal_notes, client_id, user_id, collection_date, payment_date, provider
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        tramite.id,
        tramite.creation_date,
        tramite.tramitation_date || "",
        tramite.activation_date || "",
        tramite.renovation_date || "",
        tramite.sales_name,
        tramite.comision || 0,
        tramite.comision_sales_person || 0,
        tramite.status,
        tramite.liquidez_status || null,
        JSON.stringify(tramite.notes || []),
        JSON.stringify(tramite.internal_notes || []),
        tramite.client_id,
        tramite.user_id,
        tramite.collection_date || null,
        tramite.payment_date || null,
        tramite.provider || null,
      ],
    });

    const queryTime = performance.now() - startTime;
    console.log(`[PERFORMANCE] Tramite insert: ${queryTime.toFixed(2)}ms`);

    return { success: true };
  } catch (error) {
    console.error("Error adding tramite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const addContractsOptimized = async (
  contracts: ContractDB[],
  db: DBExecutor
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (contracts.length === 0) {
      return { success: true };
    }

    const startTime = performance.now();

    // Use batch insert for better performance - include both legacy and ID fields
    const placeholders = contracts
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");

    const values = contracts.flatMap((contract) => [
      contract.id,
      contract.type,
      contract.province,
      contract.city,
      contract.address,
      contract.postal_code,
      contract.old_company || "",
      contract.new_company || "", // Legacy field - use empty string if not provided
      contract.plan,
      contract.consumption || 0,
      contract.CUPS,
      contract.pot1 || 0,
      contract.pot2 || 0,
      contract.pot3 || 0,
      contract.pot4 || 0,
      contract.pot5 || 0,
      contract.pot6 || 0,
      contract.description || "",
      contract.tramite_id,
    ]);

    await db.execute({
      sql: `
        INSERT INTO contracts (
          id, type, province, city, address, postal_code, 
          old_company, new_company, plan, consumption, CUPS, 
          pot1, pot2, pot3, pot4, pot5, pot6, 
          description, tramite_id
        ) VALUES ${placeholders}
      `,
      args: values,
    });

    const queryTime = performance.now() - startTime;
    console.log(
      `[PERFORMANCE] Contracts batch insert (${contracts.length}): ${queryTime.toFixed(2)}ms`
    );

    return { success: true };
  } catch (error) {
    console.error("Error adding contracts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const addTramiteFilesOptimized = async (
  files: TramiteFile[],
  db: DBExecutor
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (files.length === 0) {
      return { success: true };
    }

    const startTime = performance.now();

    // Use batch insert for better performance
    const placeholders = files.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

    const values = files.flatMap((file) => [
      file.id,
      file.tramite_id,
      file.filename,
      file.size,
      file.extension,
      file.upload_date,
      file.download_url,
      file.preview_url || null,
    ]);

    await db.execute({
      sql: `
        INSERT INTO tramite_files (
          id, tramite_id, filename, size, extension, upload_date, download_url, preview_url
        ) VALUES ${placeholders}
      `,
      args: values,
    });

    const queryTime = performance.now() - startTime;
    console.log(
      `[PERFORMANCE] Files batch insert (${files.length}): ${queryTime.toFixed(2)}ms`
    );

    return { success: true };
  } catch (error) {
    console.error("Error adding tramite files:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Creates a new contract (tramite) with all associated data
 * Maintains 100% compatibility with /api/tramites/add endpoint
 *
 * @param request - Next.js request object containing form data
 * @returns Promise<NextResponse<ContractCreateResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ContractCreateResponse>> {
  const startTime = performance.now();

  try {
    // Initialize database connection
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

    // Parse form data (maintaining exact compatibility)
    const formData = await request.formData();

    const tramiteString = formData.get("tramite") as string;
    const clientString = formData.get("client") as string;
    const contractsString = formData.get("contracts") as string;
    const documents = formData.get("files") as string;
    const signerString = formData.get("signer") as string;
    const userDataString = formData.get("userData") as string;
    const existingFilesString = formData.get("existingFiles") as string;

    // Validate required fields
    if (!tramiteString || !clientString || !userDataString) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Parse and validate data with Zod
    let tramite: TramiteDB;
    let client: ClientDB;
    let contracts: ContractDB[];
    let signer: SignerDB | null;
    let tramiteFiles: TramiteFile[];
    let userData: UserData;
    let existingFiles: TramiteFile[];

    try {
      tramite = TramiteSchema.parse(JSON.parse(tramiteString)) as TramiteDB;

      // Parse client data and handle coordinates properly
      const clientData = JSON.parse(clientString);
      client = ClientSchema.parse(clientData);

      // Ensure tramite.client_id is set to client.id if missing or empty
      if (!tramite.client_id || tramite.client_id.trim() === "") {
        tramite.client_id = client.id;
        console.log(
          `[VALIDATION] Auto-assigned client_id: ${client.id} to tramite: ${tramite.id}`
        );
      }

      // Validate that tramite.client_id matches client.id
      if (tramite.client_id !== client.id) {
        console.warn(
          `[VALIDATION] Mismatch between tramite.client_id (${tramite.client_id}) and client.id (${client.id}). Using client.id.`
        );
        tramite.client_id = client.id;
      }

      contracts = contractsString
        ? z.array(ContractSchema).parse(JSON.parse(contractsString))
        : [];
      signer = signerString
        ? SignerSchema.parse(JSON.parse(signerString))
        : null;

      // Ensure signer.client_id matches client.id if signer exists
      if (signer && (!signer.client_id || signer.client_id.trim() === "")) {
        signer.client_id = client.id;
        console.log(
          `[VALIDATION] Auto-assigned client_id: ${client.id} to signer: ${signer.id}`
        );
      } else if (signer && signer.client_id !== client.id) {
        console.warn(
          `[VALIDATION] Mismatch between signer.client_id (${signer.client_id}) and client.id (${client.id}). Using client.id.`
        );
        signer.client_id = client.id;
      }

      tramiteFiles = documents
        ? z.array(TramiteFileSchema).parse(JSON.parse(documents))
        : [];
      userData = UserSchema.parse(JSON.parse(userDataString));
      // userData is used for validation and logging purposes
      existingFiles = existingFilesString
        ? z.array(TramiteFileSchema).parse(JSON.parse(existingFilesString))
        : [];
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid data format",
        },
        { status: 400 }
      );
    }

    // Pre-compute any external dependencies BEFORE starting transaction
    // e.g., geocoding the client address
    let coordinates: [number, number] | null = null;
    try {
      coordinates = await geocodeAddress(
        client.address,
        client.postal_code,
        client.province
      );
    } catch (geoError) {
      // Don't fail the flow if geocoding fails; log and continue
      console.warn(
        "Geocoding failed, continuing without coordinates",
        geoError
      );
    }

    // Start transaction for data consistency
    const transactionStartTime = performance.now();
    const tx = await tursoClient.transaction();

    try {
      // Execute operations SEQUENTIALLY inside the same transaction
      const clientRes = await addClientOptimized(client, tx, coordinates);
      if (!clientRes.success) throw new Error(clientRes.error);

      if (
        (client.type === "Empresa" ||
          client.type === "Comunidad de Propietarios") &&
        signer
      ) {
        const signerRes = await addSignerOptimized(signer, tx);
        if (!signerRes.success) throw new Error(signerRes.error);
      }

      const tramiteRes = await addTramiteOptimized(tramite, tx);
      if (!tramiteRes.success) throw new Error(tramiteRes.error);

      if (contracts && contracts.length > 0) {
        const contractsRes = await addContractsOptimized(contracts, tx);
        if (!contractsRes.success) throw new Error(contractsRes.error);
      }

      if (tramiteFiles && tramiteFiles.length > 0) {
        const filesRes = await addTramiteFilesOptimized(tramiteFiles, tx);
        if (!filesRes.success) throw new Error(filesRes.error);
      }

      if (existingFiles && existingFiles.length > 0) {
        const existingFilesRes = await addTramiteFilesOptimized(
          existingFiles,
          tx
        );
        if (!existingFilesRes.success) throw new Error(existingFilesRes.error);
      }

      // Record tramite creation in changes history
      await recordTramiteCreation(
        tx,
        tramite.id,
        userData.id,
        `Trámite creado por ${userData.name}`
      );

      // Commit transaction
      await tx.commit();

      const transactionTime = performance.now() - transactionStartTime;
      const totalTime = performance.now() - startTime;

      // Log performance metrics
      const metrics: QueryMetrics = {
        queryTime: totalTime,
        operationsCompleted: 1 /* transaction committed */,
        transactionTime,
      };

      console.log(
        `[PERFORMANCE] Contract creation completed in ${totalTime.toFixed(2)}ms for user ${userData.name} (${userData.id}):`,
        metrics
      );

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      // Rollback transaction on error
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating contract:", error);

    const totalTime = performance.now() - startTime;
    console.log(
      `[PERFORMANCE] Contract creation failed after ${totalTime.toFixed(2)}ms`
    );

    // Distinguish common error categories
    const message =
      error instanceof Error ? error.message : "Error al agregar trámite";

    const status = message.includes("Invalid data format")
      ? 400
      : message.toLowerCase().includes("database") ||
          message.toLowerCase().includes("constraint")
        ? 500
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}

/**
 * GET endpoint for retrieving contracts (paginated)
 *
 * Migration from: /api/tramites/get/paginated-tramites
 * New endpoint: /new_api/contracts (GET)
 *
 * @param request - Next.js request object
 * @returns Promise<NextResponse<PaginatedContractsResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<PaginatedContractsResponse>> {
  const startTime = performance.now();

  try {
    // Parse query parameters from URL
    const searchParams = request.nextUrl.searchParams;

    // Helper function to parse JSON from query params safely
    const parseJsonParam = (
      param: string | null
    ): { from?: Date; to?: Date } | undefined => {
      if (!param) return undefined;
      try {
        const parsed = JSON.parse(decodeURIComponent(param));
        if (!parsed || typeof parsed !== "object") return undefined;
        const obj = parsed as { from?: string; to?: string };
        const fromVal = obj.from;
        const toVal = obj.to;
        const result: { from?: Date; to?: Date } = {};
        if (fromVal) result.from = new Date(fromVal);
        if (toVal) result.to = new Date(toVal);
        return result;
      } catch {
        return undefined;
      }
    };

    // Helper function to parse array params
    const parseArrayParam = (param: string | null): string[] | undefined => {
      if (!param) return undefined;
      try {
        const decoded = decodeURIComponent(param);
        return JSON.parse(decoded);
      } catch {
        // Fallback: split by comma if not valid JSON
        return param.split(",").filter(Boolean);
      }
    };

    // Extract and validate parameters from query string
    const requestData = {
      page: parseInt(searchParams.get("page") || "1"),
      rowsPerPage:
        searchParams.get("rowsPerPage") === "Sin Límite"
          ? "Sin Límite"
          : parseInt(searchParams.get("rowsPerPage") || "15"),
      user_id: searchParams.get("user_id") || "",
      user_role: searchParams.get("user_role") || "",
      filterValue: searchParams.get("filterValue") || undefined,
      companyFilter: parseArrayParam(searchParams.get("companyFilter")),
      statusFilter: parseArrayParam(searchParams.get("statusFilter")),
      liquidezStatusFilter: parseArrayParam(
        searchParams.get("liquidezStatusFilter")
      ),
      contractTypeFilter: parseArrayParam(
        searchParams.get("contractTypeFilter")
      ),
      activationDateRange: parseJsonParam(
        searchParams.get("activationDateRange")
      ),
      creationDateRange: parseJsonParam(searchParams.get("creationDateRange")),
      renovationDateRange: parseJsonParam(
        searchParams.get("renovationDateRange")
      ),
      collectionDateRange: parseJsonParam(
        searchParams.get("collectionDateRange")
      ),
      paymentDateRange: parseJsonParam(searchParams.get("paymentDateRange")),
      userFilter: parseArrayParam(searchParams.get("userFilter")),
      clientFilter: searchParams.get("clientFilter") || undefined,
      providerFilter: parseArrayParam(searchParams.get("providerFilter")),
    };

    // Validate input parameters
    const validatedData = PaginatedContractsRequestSchema.parse(requestData);

    const {
      page,
      rowsPerPage,
      user_id,
      user_role,
      filterValue,
      companyFilter,
      statusFilter,
      liquidezStatusFilter,
      contractTypeFilter,
      activationDateRange,
      creationDateRange,
      renovationDateRange,
      collectionDateRange,
      paymentDateRange,
      userFilter,
      clientFilter,
      providerFilter,
    } = validatedData;

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Calculate pagination offset
    const offset =
      rowsPerPage === "Sin Límite"
        ? 0
        : typeof rowsPerPage === "number"
          ? (page - 1) * rowsPerPage
          : 0;

    // Build dynamic filters and parameters (exact original logic)
    const filters: string[] = [];
    const params: (string | number)[] = [];

    // User role-based filtering (preserved exact logic)
    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        filters.push(
          `(t.user_id = ? OR (t.status != 'Borrador' AND t.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")})))`
        );
        params.push(user_id, ...subcomerciales.ids);
      } else {
        filters.push(`t.user_id = ?`);
        params.push(user_id);
      }
    } else {
      // For other roles: apply userFilter if provided, otherwise show all non-draft tramites
      if (userFilter && userFilter.length > 0) {
        filters.push(
          `(t.user_id IN (${userFilter.map(() => "?").join(", ")}) AND 
           (t.user_id = ? OR t.status != 'Borrador'))`
        );
        params.push(...userFilter, user_id);
      } else {
        filters.push(
          `(t.user_id = ? OR (t.user_id != ? AND t.status != 'Borrador'))`
        );
        params.push(user_id, user_id);
      }
    }

    // Dynamic text filter helper
    const addTextFilter = (fields: string[], value: string) => {
      const likeConditions = fields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      filters.push(`(${likeConditions})`);
      fields.forEach(() => params.push(`%${value}%`));
    };

    // Apply text search filter
    if (filterValue) {
      addTextFilter(
        [
          "t.id",
          "t.sales_name",
          "c.name",
          "c.last_name",
          "c.email",
          "con.CUPS",
        ],
        filterValue
      );
    }

    // Array-based filters helper
    const addArrayFilter = (column: string, filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
        params.push(...filterArray);
      }
    };

    // Provider filter helper (case-insensitive)
    const addProviderFilter = (filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        const providerConditions = filterArray
          .map(() => "LOWER(t.provider) LIKE LOWER(?)")
          .join(" OR ");
        filters.push(`(${providerConditions})`);
        // Add wildcards for partial matching
        params.push(...filterArray.map((provider) => `%${provider}%`));
      }
    };

    // Apply array-based filters
    addArrayFilter("con.new_company", companyFilter);
    addArrayFilter("t.status", statusFilter);
    addArrayFilter("con.type", contractTypeFilter);
    addArrayFilter("t.liquidez_status", liquidezStatusFilter);
    if (clientFilter) {
      addArrayFilter("c.id", [clientFilter]);
    }

    if (providerFilter) {
      addProviderFilter(providerFilter);
    }

    // Date range filter helper (preserved exact logic)
    const addDateRangeFilter = (
      column: string,
      dateRange?: { from?: Date; to?: Date }
    ) => {
      if (dateRange && dateRange.from && dateRange.to) {
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);

        fromDate.setDate(fromDate.getDate() + 1);
        toDate.setDate(toDate.getDate() + 1);

        filters.push(`date(${column}) BETWEEN date(?) AND date(?)`);
        params.push(
          fromDate.toISOString().split("T")[0],
          toDate.toISOString().split("T")[0]
        );
      }
    };

    // Apply date range filters
    addDateRangeFilter("activation_date", activationDateRange);
    addDateRangeFilter("creation_date", creationDateRange);
    addDateRangeFilter("renovation_date", renovationDateRange);
    addDateRangeFilter("collection_date", collectionDateRange);
    addDateRangeFilter("payment_date", paymentDateRange);

    // Construct base query
    let baseQuery = `
      FROM 
          tramites t
      LEFT JOIN 
          clients c ON t.client_id = c.id
      LEFT JOIN 
          contracts con ON t.id = con.tramite_id
    `;

    // Add WHERE clause if filters exist
    if (filters.length > 0) {
      baseQuery += ` WHERE ` + filters.join(" AND ");
    }

    // Total count query
    const countQuery = `
      SELECT COUNT(DISTINCT t.id) AS total
      ${baseQuery}
    `;

    const limitQuery = `LIMIT ? OFFSET ?`;

    // Main query with data retrieval
    const dataQuery = `
      SELECT 
          t.id AS id,
          t.creation_date AS creation_date,
          t.activation_date AS activation_date,
          t.renovation_date AS renovation_date,
          t.collection_date AS collection_date,
          t.payment_date AS payment_date,
          t.sales_name AS sales_name,
          t.comision_sales_person AS comision_sales_person,
          t.comision AS comision,
          t.status AS status,
          t.liquidez_status AS liquidez_status,
          t.provider AS provider,
          c.name AS client_name,
          c.last_name AS client_last_name,
          c.email AS client_email,
          c.id AS client_id,
          COALESCE(GROUP_CONCAT(DISTINCT con.CUPS), '') AS CUPS,
          COALESCE(GROUP_CONCAT(DISTINCT con.new_company), '') AS new_companies,
          COALESCE(GROUP_CONCAT(DISTINCT con.old_company), '') AS old_companies,
          COALESCE(GROUP_CONCAT(DISTINCT con.plan), '') AS plans,
          COALESCE(GROUP_CONCAT(DISTINCT con.type), '') AS contract_types,
          COALESCE(GROUP_CONCAT(DISTINCT con.consumption), '') AS consumptions
      ${baseQuery}
      GROUP BY 
          t.id, t.creation_date, t.renovation_date, t.sales_name, 
          t.comision_sales_person, t.comision, t.status, t.liquidez_status,
          c.name, c.last_name, c.email
      ORDER BY t.creation_date DESC
      ${rowsPerPage === "Sin Límite" ? "" : typeof rowsPerPage === "number" ? limitQuery : ""}
    `;

    // Add pagination parameters
    const countParams = [...params];
    const dataParams =
      typeof rowsPerPage === "number"
        ? [...params, rowsPerPage, offset]
        : [...params];

    // Execute count query
    const countResult = await tursoClient.execute({
      sql: countQuery,
      args: countParams,
    });
    const total = Number(countResult.rows[0]?.total || 0);

    // Execute data query
    const dataResult = await tursoClient.execute({
      sql: dataQuery,
      args: dataParams,
    });

    // Process and return results (exact original format)
    const processedData = dataResult.rows.map((row) => {
      const parseArray = (value: string | null) =>
        value ? value.split(",").filter(Boolean) : [];

      const parseNumericArray = (value: string | null) =>
        value
          ? (value
              .split(",")
              .map((x) => {
                const num = Number(x);
                return !isNaN(num) ? num : null;
              })
              .filter((x) => x !== null) as number[])
          : [];

      return {
        id: row.id as string,
        creation_date: row.creation_date as string,
        activation_date: row.activation_date as string,
        renovation_date: row.renovation_date as string,
        collection_date: row.collection_date as string | null,
        payment_date: row.payment_date as string | null,
        sales_name: row.sales_name as string,
        client_name: `${row.client_name || ""} ${
          row.client_last_name || ""
        }`.trim(),
        client_email: row.client_email as string,
        client_id: row.client_id as string,
        CUPS: parseArray(row.CUPS as string),
        new_company: parseArray(row.new_companies as string),
        old_company: parseArray(row.old_companies as string),
        plan: parseArray(row.plans as string),
        contract_type: parseArray(row.contract_types as string),
        consumption: parseNumericArray(row.consumptions as string),
        comision_sales_person: row.comision_sales_person as number,
        comision: row.comision as number,
        status: row.status as string,
        liquidez_status: row.liquidez_status as string,
        provider: row.provider as string | null,
      };
    });

    // Performance tracking
    const totalTime = performance.now() - startTime;
    console.log(
      `[PERFORMANCE] GET Contracts pagination completed in ${totalTime.toFixed(2)}ms for user ${user_id}`
    );

    // Return exact original response format
    return NextResponse.json({
      success: true,
      data: processedData,
      total,
    });
  } catch (error) {
    console.error("Error en el servidor obteniendo los trámites", error);

    const totalTime = performance.now() - startTime;
    console.log(
      `[PERFORMANCE] GET Contracts pagination failed after ${totalTime.toFixed(2)}ms`
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error en el servidor obteniendo los trámites",
      },
      { status: 500 }
    );
  }
}
