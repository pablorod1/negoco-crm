import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  executeReadWithRetry,
  isRetryableLibsqlError,
} from "@/core/libsql/executeWithRetry";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import {
  ComparativaDB,
  ComparativaFile,
  ComparativaPlan,
} from "@/comparativas/types";
import { DateRange } from "react-day-picker";
import {
  ComparativaIdempotencyConflictError,
  createComparativaIdempotently,
} from "@/comparativas/server/createComparativa";

/**
 * Types for Paginated Comparisons (GET endpoint)
 */
interface PaginatedComparisonsRequest {
  page: number;
  rowsPerPage: number | string;
  user_id: string;
  user_role: string;
  filterValue?: string;
  statusFilter?: string[];
  dateRange?: DateRange | undefined;
  userFilter?: string[];
  companyFilter?: string[];
  excludeCompany?: boolean;
  excludeUser?: boolean;
}

interface ComparisonResponseItem {
  id: string;
  creation_date: string;
  client: string;
  comision_sales_person: {
    fijo: number;
    indexado: number;
  };
  comision: {
    fijo: number;
    indexado: number;
  };
  status: string;
  service: "Luz" | "Gas";
  plan: ComparativaPlan[];
  tramite_id: string;
  company_id?: string; // Now contains company name instead of ID
  user: {
    name: string;
    email: string;
    image: string;
  };
}

interface PaginatedComparisonsResponse {
  success: boolean;
  data?: ComparisonResponseItem[];
  total?: number;
  error?: string;
}

interface ComparisonCreateResponse {
  success: boolean;
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

// Zod Validation Schemas
const ComparativaPlanSchema = z.enum(["fijo", "indexado"]);

const ComparativaStatusSchema = z.enum([
  "pending",
  "completed",
  "processed",
  "rejected",
]);

const ServiceSchema = z.enum(["Luz", "Gas"]);

const ComparativaComisionSchema = z.object({
  fijo: z.number().min(0, "Fixed commission must be positive or zero"),
  indexado: z.number().min(0, "Indexed commission must be positive or zero"),
});

const ComparativaSchema = z.object({
  id: z.string().min(1, "Comparison ID is required"),
  client: z.string().min(1, "Client name is required"),
  service: ServiceSchema,
  plan: z.array(ComparativaPlanSchema).min(1, "At least one plan is required"),
  comision: ComparativaComisionSchema,
  comision_sales_person: ComparativaComisionSchema,
  notes: z.array(z.string()).default([]),
  user_id: z.string().min(1, "User ID is required"),
  creation_date: z.string().min(1, "Creation date is required"),
  company_id: z.string().nullable().optional(),
  status: ComparativaStatusSchema,
  tramite_id: z.string().optional(),
  has_permanencia: z.number().optional().default(0),
  has_renovacion: z.number().optional().default(0),
});

const ComparativaFileSchema = z.object({
  id: z.string().min(1, "File ID is required"),
  comparativa_id: z.string().min(1, "Comparison ID is required"),
  filename: z.string().min(1, "Filename is required"),
  size: z.number().min(0, "File size must be positive or zero"),
  extension: z.string().min(1, "File extension is required"),
  upload_date: z.string().min(1, "Upload date is required"),
  download_url: z.string().url("Invalid download URL"),
  preview_url: z.string().url("Invalid preview URL").nullable(),
});

// Zod schema for GET endpoint pagination
const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1),
  rowsPerPage: z.coerce.number().int().min(1).max(100),
  user_id: z.string().min(1),
  user_role: z.string().min(1),
  filterValue: z.string().optional(),
  statusFilter: z.array(z.string()).optional(),
  dateRange: z
    .object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .optional(),
  userFilter: z.array(z.string()).optional(),
  companyFilter: z.array(z.string()).optional(),
  excludeCompany: z.boolean().optional(),
  excludeUser: z.boolean().optional(),
});

/**
 * GET /new_api/comparisons
 *
 * Refactored endpoint for fetching paginated comparisons data
 *
 * Migration from: /api/comparativas/get/paginated-comparativas
 *
 * @param request - Next.js request object containing query parameters
 * @returns Promise<NextResponse<PaginatedComparisonsResponse>>
 *
 * Performance Optimizations:
 * - Prepared statements for SQL injection prevention
 * - Optimized JOIN operations
 * - Efficient pagination with LIMIT/OFFSET
 * - Enhanced error handling and logging
 * - Type-safe parameter validation with Zod
 *
 * Backward Compatibility:
 * - Supports both GET (query params) and POST (body) for gradual migration
 * - Maintains identical response structure
 * - Preserves all filtering and pagination logic
 * - Compatible with existing frontend components
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<PaginatedComparisonsResponse>> {
  const startTime = performance.now();

  try {
    // Extract query parameters from URL
    const { searchParams } = new URL(request.url);

    const parseJsonParam = <T,>(param: string | null): T | undefined => {
      if (!param) return undefined;
      try {
        return JSON.parse(param) as T;
      } catch {
        return undefined;
      }
    };

    // Parse query parameters (convert from URL params to original format)
    const rowsParam = searchParams.get("rowsPerPage");
    const rowsPerPageParsed: number =
      rowsParam === null
        ? 50
        : rowsParam === "Sin Límite"
          ? 100
          : Math.min(Number(rowsParam), 100);

    const requestData: PaginatedComparisonsRequest = {
      page: parseInt(searchParams.get("page") || "1"),
      rowsPerPage: rowsPerPageParsed,
      user_id: searchParams.get("user_id") || "",
      user_role: searchParams.get("user_role") || "",
      filterValue: searchParams.get("filterValue") || undefined,
      statusFilter: parseJsonParam<string[]>(searchParams.get("statusFilter")),
      dateRange: parseJsonParam<DateRange>(searchParams.get("dateRange")),
      userFilter: parseJsonParam<string[]>(searchParams.get("userFilter")),
      companyFilter: parseJsonParam<string[]>(searchParams.get("companyFilter")),
      excludeCompany: searchParams.get("excludeCompany") === "true",
      excludeUser: searchParams.get("excludeUser") === "true",
    };

    // Validate request parameters
    const validationResult = PaginationQuerySchema.safeParse(requestData);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 },
      );
    }

    const {
      page,
      rowsPerPage,
      user_id,
      user_role,
      filterValue,
      statusFilter,
      dateRange,
      userFilter,
      companyFilter,
      excludeCompany,
      excludeUser,
    } = validationResult.data;

    // Initialize database client
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

    // Calculate pagination offset
    const offset = (page - 1) * rowsPerPage;

    // Base query (exactly matching original structure)
    let query = `SELECT 
                  c.id AS id,
                  c.creation_date AS creation_date,
                  c.client AS client,
                  c.comision_sales_person_fijo AS comision_sales_person_fijo,
                  c.comision_sales_person_indexado AS comision_sales_person_indexado,
                  c.comision_fijo AS comision_fijo,
                  c.comision_indexado AS comision_indexado,
                  c.status AS status,
                  c.service AS service,
                  com.name AS company_name,
                  c.tramite_id AS tramite_id,
                  CASE 
                    WHEN JSON_VALID(c.plan) THEN c.plan
                    ELSE JSON_ARRAY(c.plan)
                  END AS plan,
                  u.name AS user_name,
                  u.email AS user_email,
                  u.image AS user_image
              FROM comparativas c
              JOIN user u ON c.user_id = u.id
              LEFT JOIN comercializadoras com ON c.company_id = com.id`;

    const filters: string[] = [];
    const params: (string | number)[] = [];

    // Handle user role-based filtering (exact original logic)
    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids.length > 0) {
        filters.push(
          `( c.user_id = ? OR c.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")}))`,
        );
        params.push(user_id, ...subcomerciales.ids);
      } else {
        filters.push(`c.user_id = ?`);
        params.push(user_id);
      }
    }

    // Text filter function (exact original implementation)
    const addTextFilter = (fields: string[], value: string) => {
      const likeConditions = fields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      filters.push(`(${likeConditions})`);
      fields.forEach(() => params.push(`%${value}%`));
    };

    // Apply text-based filtering
    if (filterValue) {
      addTextFilter(["c.client", "c.id", "u.email", "u.name"], filterValue);
    }

    // Array filter function (exact original implementation)
    const addArrayFilter = (column: string, filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
        params.push(...filterArray);
      }
    };

    // Apply date range filtering (exact original logic)
    if (dateRange && dateRange.from && dateRange.to) {
      const fromDate = new Date(dateRange.from);
      const toExclusiveDate = new Date(dateRange.to);
      toExclusiveDate.setDate(toExclusiveDate.getDate() + 1);

      filters.push(`c.creation_date >= ? AND c.creation_date < ?`);
      params.push(fromDate.toISOString(), toExclusiveDate.toISOString());
    }

    // Apply status and user filters
    if (statusFilter) addArrayFilter("c.status", statusFilter);
    if (userFilter && userFilter.length > 0) {
      const placeholders = userFilter.map(() => "?").join(", ");
      if (excludeUser) {
        filters.push(
          `(c.user_id NOT IN (${placeholders}) OR c.user_id IS NULL)`,
        );
      } else {
        filters.push(`c.user_id IN (${placeholders})`);
      }
      params.push(...userFilter);
    }
    if (companyFilter && companyFilter.length > 0) {
      const placeholders = companyFilter.map(() => "?").join(", ");
      if (excludeCompany) {
        filters.push(
          `(c.company_id NOT IN (${placeholders}) OR c.company_id IS NULL)`,
        );
      } else {
        filters.push(`c.company_id IN (${placeholders})`);
      }
      params.push(...companyFilter);
    }

    // Build count query for pagination
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM comparativas c
    `;

    if (filterValue) {
      countQuery += ` JOIN user u ON c.user_id = u.id`;
    }

    // Apply filters to both queries
    if (filters.length > 0) {
      const whereClause = ` WHERE ` + filters.join(" AND ");
      query += whereClause;
      countQuery += whereClause;
    }

    // Complete the data query before executing (no GROUP BY needed: JOINs are 1:1)
    query += ` ORDER BY c.creation_date DESC, c.id DESC`;

    // Snapshot params for count before adding pagination params
    const countParams = [...params];

    query += ` LIMIT ? OFFSET ?`;
    params.push(rowsPerPage, offset);

    // Execute count and data queries in parallel
    const [countResult, rs] = await Promise.all([
      executeReadWithRetry(tursoClient, { sql: countQuery, args: countParams }),
      executeReadWithRetry(tursoClient, { sql: query, args: params }),
    ]);

    const total = Number(countResult.rows[0]?.total) || 0;

    // Transform results (exact original format)
    const transformedData: ComparisonResponseItem[] = rs.rows.map((row) => ({
      id: row.id as string,
      creation_date: row.creation_date as string,
      client: row.client as string,
      comision_sales_person: {
        fijo: Number(row.comision_sales_person_fijo) || 0,
        indexado: Number(row.comision_sales_person_indexado) || 0,
      },
      comision: {
        fijo: Number(row.comision_fijo) || 0,
        indexado: Number(row.comision_indexado) || 0,
      },
      status: row.status as string,
      service: row.service as "Luz" | "Gas",
      plan: JSON.parse(row.plan as string) as ComparativaPlan[],
      tramite_id: row.tramite_id as string,
      company_id: row.company_name as string | undefined,
      user: {
        name: row.user_name as string,
        email: row.user_email as string,
        image: row.user_image as string,
      },
    }));

    // Return exact original response format
    return NextResponse.json({
      success: true,
      data: transformedData,
      total,
    });
  } catch (error) {
    const endTime = performance.now();
    if (isRetryableLibsqlError(error)) {
      console.warn("Turso unavailable fetching comparisons:", {
        error: error instanceof Error ? error.message : error,
        executionTime: `${(endTime - startTime).toFixed(2)}ms`,
      });
      return databaseUnavailableResponse();
    }

    console.error("❌ Error in GET /new_api/comparisons:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      executionTime: `${(endTime - startTime).toFixed(2)}ms`,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /new_api/comparisons
 *
 * This endpoint handles two different operations based on the request body:
 * 1. Create new comparison (when body contains comparativa + files)
 * 2. Get paginated comparisons (when body contains pagination params - backward compatibility)
 *
 * Migration from: /api/comparativas/add (create) + /api/comparativas/get/paginated-comparativas (list)
 */
export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<ComparisonCreateResponse | PaginatedComparisonsResponse>
> {
  const startTime = performance.now();

  try {
    const contentType = request.headers.get("content-type");

    // Check if this is a FormData request (comparison creation)
    if (contentType?.includes("multipart/form-data")) {
      return await handleComparisonCreation(request);
    }

    // Otherwise, this is a JSON request for pagination (backward compatibility)
    const requestData: PaginatedComparisonsRequest = await request.json();

    // Check if this looks like a pagination request
    if ("page" in requestData && "rowsPerPage" in requestData) {
      return await handlePaginatedRequest(request, requestData);
    }

    // If we can't determine the request type, return an error
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request format",
      },
      { status: 400 },
    );
  } catch (error) {
    const endTime = performance.now();
    console.error("❌ Error in POST /new_api/comparisons:", {
      error: error instanceof Error ? error.message : error,
      executionTime: `${(endTime - startTime).toFixed(2)}ms`,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Handle comparison creation (FormData request)
 */
async function handleComparisonCreation(
  request: NextRequest,
): Promise<NextResponse<ComparisonCreateResponse>> {
  try {
    // Initialize database client
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

    // Parse FormData (maintaining exact compatibility with original endpoint)
    const formData = await request.formData();

    const comparativaString = formData.get("comparativa") as string;
    const documents = formData.get("files") as string;

    // Validate required fields (preserving original validation logic)
    if (!comparativaString || !documents) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 },
      );
    }

    let rawComparativa: unknown;
    let rawComparativaFiles: unknown;
    try {
      rawComparativa = JSON.parse(comparativaString);
      rawComparativaFiles = JSON.parse(documents);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid data format",
        },
        { status: 400 },
      );
    }

    const comparativaResult = ComparativaSchema.safeParse(rawComparativa);
    const filesResult = z
      .array(ComparativaFileSchema)
      .safeParse(rawComparativaFiles);
    if (!comparativaResult.success || !filesResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid data format",
        },
        { status: 400 },
      );
    }

    const comparativa: ComparativaDB = {
      ...comparativaResult.data,
      tramite_id: comparativaResult.data.tramite_id,
      company_id: comparativaResult.data.company_id ?? undefined,
    };
    const comparativaFiles: ComparativaFile[] = filesResult.data;

    if (
      comparativaFiles.some(
        (file) => file.comparativa_id !== comparativa.id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid comparison file reference",
        },
        { status: 400 },
      );
    }

    try {
      await createComparativaIdempotently(
        tursoClient,
        comparativa,
        comparativaFiles,
      );
    } catch (error) {
      if (error instanceof ComparativaIdempotencyConflictError) {
        return NextResponse.json(
          {
            success: false,
            error: "Comparison creation conflict",
          },
          { status: 409 },
        );
      }

      console.error("Error creating comparison transaction:", error);
      return NextResponse.json(
        {
          success: false,
          error: "No se ha podido crear la comparativa",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating comparison:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Handle paginated request (backward compatibility with original POST endpoint)
 */
async function handlePaginatedRequest(
  request: NextRequest,
  requestData: PaginatedComparisonsRequest,
): Promise<NextResponse<PaginatedComparisonsResponse>> {
  // Convert POST request to internal GET-style processing
  const searchParams = new URLSearchParams({
    page: requestData.page.toString(),
    rowsPerPage: requestData.rowsPerPage.toString(),
    user_id: requestData.user_id,
    user_role: requestData.user_role,
    ...(requestData.filterValue && { filterValue: requestData.filterValue }),
    ...(requestData.statusFilter && {
      statusFilter: JSON.stringify(requestData.statusFilter),
    }),
    ...(requestData.dateRange && {
      dateRange: JSON.stringify(requestData.dateRange),
    }),
    ...(requestData.userFilter && {
      userFilter: JSON.stringify(requestData.userFilter),
    }),
  });

  // Create a new request object for internal processing
  const internalUrl = new URL(request.url);
  internalUrl.search = searchParams.toString();

  const internalRequest = new NextRequest(internalUrl, {
    method: "GET",
    headers: request.headers,
  });

  // Delegate to GET handler for consistent processing
  return await GET(internalRequest);
}
