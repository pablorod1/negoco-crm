import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { ComparisonSourceError, getComparisonContractSource } from "@/comparativas/server/contract-source";
import {
  executeReadWithRetry,
  isRetryableLibsqlError,
} from "@/core/libsql/executeWithRetry";
import {
  buildContractBaseQuery,
  buildContractFilters,
  buildContractHydrationQuery,
  mapContractRow,
  parseContractFilterParams,
} from "@/core/libsql/contracts/contractFilters";
import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/tramites/types/tramite.types";
import { Client } from "@libsql/client";
import { recordTramiteCreation } from "@/tramites/utils/tramiteChangesHelpers";
import { getCrmSettings, isProviderAllowed } from "@/crm-settings/server";
import {
  cancelPendingProcessingJobsFromRequest,
  createProcessingJobFromRequest,
} from "@/crm-settings/processing-jobs";

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
    "Adelantado",
    "Pendiente de Descontar",
    "Descontado",
  ])
  .nullable();

const DocumentTypeSchema = z.enum(["DNI", "NIE", "CIF", "Otro", ""]);

const EmailFormatSchema = z.string().email("Invalid email format");

const OptionalEmailSchema = z.preprocess(
  (value) => (value == null ? "" : value),
  z
    .string()
    .trim()
    .refine(
      (value) => value === "" || EmailFormatSchema.safeParse(value).success,
      {
        message: "Invalid email format",
      },
    ),
);

// Pagination-specific schemas
const DateRangeSchema = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
  })
  .optional();

const PaginatedContractsRequestSchema = z.object({
  page: z.number().min(1, "Page must be at least 1"),
  rowsPerPage: z.number().int().min(1).max(100),
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
  excludeCompany: z.boolean().optional(),
  excludeUser: z.boolean().optional(),
});

const TramiteSchema = z.object({
  id: z.string().min(1, "Tramite ID is required"),
  creation_date: z.string().min(1, "Creation date is required"),
  tramitation_date: z.string().optional().default(""),
  activation_date: z.string().optional().default(""),
  renovation_date: z.string().optional().default(""),
  collection_date: z.string().nullable().optional(),
  payment_date: z.string().nullable().optional(),
  processing_date: z.string().nullable().optional(),
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
          code: z.ZodIssueCode.too_small,
          minimum: 1,
          origin: "string",
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
  plan: z.enum(["fijo", "indexado"]).nullable().optional(),
});

const ClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z.string().min(1, "Client name is required"),
  last_name: z.string().optional().default(""),
  email: OptionalEmailSchema,
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
    email: OptionalEmailSchema,
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
            code: z.ZodIssueCode.too_small,
            minimum: 1,
            origin: "string",
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
  rejected_date: string | null;
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

const databaseUnavailableResponse = () =>
  NextResponse.json(
    {
      success: false,
      error: "Base de datos temporalmente no disponible",
    },
    {
      status: 503,
      headers: {
        "Retry-After": "1",
      },
    },
  );

// A minimal interface for a DB executor (client or transaction)
type DBExecutor = Pick<Client, "execute">;

// Optimized helper functions with performance improvements
const checkClientExists = async (
  id: string,
  documentNumber: string,
  db: DBExecutor,
): Promise<boolean> => {
  try {
    const res = await db.execute({
      sql: `SELECT id FROM clients WHERE id = ? AND document_number = ? LIMIT 1`,
      args: [id, documentNumber],
    });

    return res.rows.length > 0;
  } catch (error) {
    console.error("Error checking client existence:", error);
    return false;
  }
};

const checkSignerExists = async (
  id: string,
  db: DBExecutor,
): Promise<boolean> => {
  try {
    const res = await db.execute({
      sql: `SELECT id FROM signers WHERE id = ? LIMIT 1`,
      args: [id],
    });

    return res.rows.length > 0;
  } catch (error) {
    console.error("Error checking signer existence:", error);
    return false;
  }
};

const geocodeAddress = async (
  address: string,
  postalCode: string,
  province: string,
): Promise<[number, number] | null> => {
  try {
    const fullAddress = `${address}, ${postalCode}, ${province}, España`;
    const openCageKey = process.env.GEOCODE_API_KEY;

    if (!openCageKey) {
      console.warn("Geocoding API key not configured");
      return null;
    }

    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        fullAddress,
      )}&key=${openCageKey}&limit=1`,
    );

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

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
  precomputedCoordinates: [number, number] | null,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const clientExists = await checkClientExists(
      client.id,
      client.document_number,
      db,
    );

    if (clientExists) {
      return { success: true };
    }

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
  db: DBExecutor,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const signerExists = await checkSignerExists(signer.id, db);

    if (signerExists) {
      return { success: true };
    }

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
  db: DBExecutor,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await db.execute({
      sql: `
        INSERT INTO tramites (
          id, creation_date, tramitation_date, activation_date, renovation_date,
          sales_name, comision, comision_sales_person, status, liquidez_status,
          notes, internal_notes, client_id, user_id, collection_date, payment_date, processing_date, provider, plan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        tramite.processing_date || null,
        tramite.provider || null,
        tramite.plan || null,
      ],
    });

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
  db: DBExecutor,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (contracts.length === 0) {
      return { success: true };
    }

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
  db: DBExecutor,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (files.length === 0) {
      return { success: true };
    }

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
  request: NextRequest,
): Promise<NextResponse<ContractCreateResponse>> {
  let isComparisonSource = false;
  try {
    // Initialize database connection
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

    // Parse form data (maintaining exact compatibility)
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Content-Type: expected multipart/form-data",
        },
        { status: 400 },
      );
    }

    const tramiteString = formData.get("tramite") as string;
    const clientString = formData.get("client") as string;
    const contractsString = formData.get("contracts") as string;
    const documents = formData.get("files") as string;
    const signerString = formData.get("signer") as string;
    const userDataString = formData.get("userData") as string;
    const existingFilesString = formData.get("existingFiles") as string;
    const sourceId = formData.get("source_comparison_id");
    isComparisonSource = sourceId !== null;
    let sourceActor: { id: string; role: string; name: string } | undefined;
    let sourceOwner: string | undefined;
    if (isComparisonSource) {
      const auth = await validateUserSession(request);
      if (!auth.success || !auth.user) throw new ComparisonSourceError(401, "Unauthorized");
      sourceActor = auth.user;
      if (typeof sourceId !== "string" || !sourceId) throw new ComparisonSourceError(400, "Invalid comparison source");
    }

    // Validate required fields
    if (!tramiteString || !clientString || !userDataString) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 },
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
      const draft = JSON.parse(tramiteString);
      if (sourceActor && typeof sourceId === "string") {
        const source = await getComparisonContractSource(tursoClient, sourceId, draft.plan, sourceActor, draft.status);
        sourceOwner = source.user_id;
        Object.assign(draft, source);
      }
      tramite = TramiteSchema.parse(draft) as TramiteDB;

      // Parse client data and handle coordinates properly
      const clientData = JSON.parse(clientString);
      client = ClientSchema.parse(clientData);

      // Ensure tramite.client_id is set to client.id if missing or empty
      if (!tramite.client_id || tramite.client_id.trim() === "") {
        tramite.client_id = client.id;
      }

      // Validate that tramite.client_id matches client.id
      if (tramite.client_id !== client.id) {
        console.warn(
          `[VALIDATION] Mismatch between tramite.client_id (${tramite.client_id}) and client.id (${client.id}). Using client.id.`,
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
      } else if (signer && signer.client_id !== client.id) {
        signer.client_id = client.id;
      }

      tramiteFiles = documents
        ? z.array(TramiteFileSchema).parse(JSON.parse(documents))
        : [];
      userData = sourceActor
        ? UserSchema.parse(sourceActor)
        : UserSchema.parse(JSON.parse(userDataString));
      // userData is used for validation and logging purposes
      existingFiles = existingFilesString
        ? z.array(TramiteFileSchema).parse(JSON.parse(existingFilesString))
        : [];
    } catch (validationError) {
      if (validationError instanceof ComparisonSourceError) throw validationError;
      console.error("Validation error:", validationError);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid data format",
        },
        { status: 400 },
      );
    }

    const crmSettings = await getCrmSettings(tursoClient);
    if (
      !isProviderAllowed(
        crmSettings.providers,
        tramite.provider ? String(tramite.provider) : null,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Proveedor no configurado",
        },
        { status: 422 },
      );
    }

    const shouldCreateProcessingJob =
      tramite.status === "Procesando" &&
      crmSettings.processing_auto_activation.enabled;

    if (tramite.status === "Procesando" && !tramite.processing_date) {
      tramite.processing_date = new Date().toISOString();
    }

    if (shouldCreateProcessingJob && tramite.processing_date) {
      await createProcessingJobFromRequest({
        request,
        tramiteId: tramite.id,
        processingDate: tramite.processing_date,
        delayMinutes: crmSettings.processing_auto_activation.delay_minutes,
      });
    }

    // Pre-compute any external dependencies BEFORE starting transaction
    // e.g., geocoding the client address
    let coordinates: [number, number] | null = null;
    try {
      coordinates = await geocodeAddress(
        client.address,
        client.postal_code,
        client.province,
      );
    } catch (geoError) {
      // Don't fail the flow if geocoding fails; log and continue
      console.warn(
        "Geocoding failed, continuing without coordinates",
        geoError,
      );
    }

    // Start transaction for data consistency
    const tx = await tursoClient.transaction("write");

    try {
      if (sourceActor && typeof sourceId === "string") {
        Object.assign(tramite, await getComparisonContractSource(tx, sourceId, tramite.plan, sourceActor, tramite.status, sourceOwner));
        if (tramite.status === "Baja") {
          tramite.comision = -tramite.comision;
          tramite.comision_sales_person = -tramite.comision_sales_person;
        }
      }
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
          tx,
        );
        if (!existingFilesRes.success) throw new Error(existingFilesRes.error);
      }

      // Record tramite creation in changes history
      await recordTramiteCreation(
        tx,
        tramite.id,
        userData.id,
        `Trámite creado por ${userData.name}`,
      );

      // Commit transaction
      await tx.commit();

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      // Rollback transaction on error
      await tx.rollback();

      if (shouldCreateProcessingJob) {
        await cancelPendingProcessingJobsFromRequest({
          request,
          tramiteId: tramite.id,
        }).catch((cancelError) => {
          console.error(
            "Error canceling processing job after failed contract creation:",
            cancelError,
          );
        });
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof ComparisonSourceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (isComparisonSource) {
      console.error("Comparison contract creation failed");
      return NextResponse.json({ success: false, error: "Error al agregar trámite" }, { status: 500 });
    }
    console.error("Error creating contract:", error);

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
      { status },
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
  request: NextRequest,
): Promise<NextResponse<PaginatedContractsResponse>> {
  try {
    // Parse query parameters from URL
    const searchParams = request.nextUrl.searchParams;

    // Extract and validate parameters from query string
    const requestData = {
      page: parseInt(searchParams.get("page") || "1"),
      rowsPerPage:
        searchParams.get("rowsPerPage") === "Sin Límite"
          ? 100
          : Math.min(
              parseInt(searchParams.get("rowsPerPage") || "50"),
              100,
            ),
      user_id: searchParams.get("user_id") || "",
      user_role: searchParams.get("user_role") || "",
      ...parseContractFilterParams(searchParams),
    };

    // Validate input parameters
    const validationResult =
      PaginatedContractsRequestSchema.safeParse(requestData);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    const { page, rowsPerPage } = validatedData;

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    // Calculate pagination offset
    const offset = (page - 1) * rowsPerPage;

    // Build dynamic filters and parameters (shared with the export endpoint)
    const { filters, params, needsContractsJoin, needsClientsJoin } =
      await buildContractFilters(tursoClient, validatedData);

    // Construct base query for the pagination/count phase.
    const baseQuery = buildContractBaseQuery({
      filters,
      needsClientsJoin,
      needsContractsJoin,
    });

    // Total count query.
    // Wrapping in a subquery + COUNT(*) is more memory-friendly than
    // COUNT(DISTINCT t.id) over an exploded contracts join: SQLite can drop
    // duplicates incrementally via GROUP BY instead of buffering a hash set
    // of all distinct ids in memory.
    const countQuery = needsContractsJoin
      ? `SELECT COUNT(*) AS total FROM (SELECT t.id ${baseQuery} GROUP BY t.id) sub`
      : `SELECT COUNT(*) AS total ${baseQuery}`;

    // Paginated tramite IDs query — small, bounded result set (page size).
    // No GROUP_CONCAT here: aggregation is deferred to the second query
    // and runs only over the page's contracts.
    const idsQuery = `
      SELECT t.id, t.creation_date
      ${baseQuery}
      ${needsContractsJoin ? "GROUP BY t.id" : ""}
      ORDER BY t.creation_date DESC, t.id DESC
      LIMIT ? OFFSET ?
    `;

    // Snapshot params for count, add pagination for ids
    const countParams = [...params];
    const idsParams = [...params, rowsPerPage, offset];

    // Execute count and id queries in parallel
    const [countResult, idsResult] = await Promise.all([
      executeReadWithRetry(tursoClient, { sql: countQuery, args: countParams }),
      executeReadWithRetry(tursoClient, { sql: idsQuery, args: idsParams }),
    ]);
    const total = Number(countResult.rows[0]?.total || 0);

    const pageIds = idsResult.rows.map((r) => String(r.id));

    // Second phase: hydrate the page with full data + aggregated contracts.
    // GROUP_CONCAT now runs over at most `rowsPerPage` tramites worth of
    // contracts, eliminating the SQLITE_NOMEM risk.
    let processedData: ContractData[] = [];
    if (pageIds.length > 0) {
      const dataResult = await executeReadWithRetry(tursoClient, {
        sql: buildContractHydrationQuery(pageIds.length),
        args: pageIds,
      });

      processedData = dataResult.rows.map((row) =>
        mapContractRow(row as unknown as Record<string, unknown>),
      );
    }

    // Return exact original response format
    return NextResponse.json({
      success: true,
      data: processedData,
      total,
    });
  } catch (error) {
    if (isRetryableLibsqlError(error)) {
      console.warn("Turso unavailable fetching contracts:", error);
      return databaseUnavailableResponse();
    }

    console.error("Error en el servidor obteniendo los trámites", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error en el servidor obteniendo los trámites",
      },
      { status: 500 },
    );
  }
}
