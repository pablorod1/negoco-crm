import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import {
  ComparativaDB,
  ComparativaFile,
  ComparativaPlan,
} from "@/comparativas/types";
import { Client } from "@libsql/client";
import { DateRange } from "react-day-picker";
import { createComparativaChange } from "@/comparativas/utils/comparativaChangesHelpers";

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
  company_id?: string;
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
  company_id: z.string().nullable(),
  status: ComparativaStatusSchema,
  tramite_id: z.string().optional(),
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
  rowsPerPage: z.union([z.coerce.number().min(1), z.string()]),
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
});

/**
 * Optimized helper function to add a comparativa to the database
 * Uses prepared statements and performance monitoring
 */
const addComparativaOptimized = async (
  comparativa: ComparativaDB,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const startTime = performance.now();

    await tursoClient.execute({
      sql: `
        INSERT INTO comparativas (
          id, client, service, plan, comision_fijo, comision_indexado, 
          comision_sales_person_fijo, comision_sales_person_indexado, 
          notes, user_id, creation_date, status, tramite_id, company_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        comparativa.id,
        comparativa.client,
        comparativa.service,
        JSON.stringify(comparativa.plan),
        comparativa.comision.fijo,
        comparativa.comision.indexado,
        comparativa.comision_sales_person.fijo,
        comparativa.comision_sales_person.indexado,
        JSON.stringify(comparativa.notes),
        comparativa.user_id,
        comparativa.creation_date,
        comparativa.status,
        comparativa.tramite_id || null,
        null,
      ],
    });

    // Track creation of comparativa
    await createComparativaChange(tursoClient, {
      comparativa_id: comparativa.id,
      user_id: comparativa.user_id,
      change_type: "created",
      field_name: null,
      old_value: null,
      new_value: null,
      description: `Comparativa creada para el cliente ${comparativa.client}`,
    });

    const queryTime = performance.now() - startTime;
    console.log(`[PERFORMANCE] Comparativa insert: ${queryTime.toFixed(2)}ms`);

    return { success: true };
  } catch (error) {
    console.error("Error adding comparativa:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

/**
 * Optimized helper function to add comparativa files to the database
 * Uses batch insert for better performance
 */
const addComparativaFilesOptimized = async (
  files: ComparativaFile[],
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (files.length === 0) {
      return { success: true };
    }

    const startTime = performance.now();

    const placeholders = files.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

    const values = files.flatMap((file) => [
      file.id,
      file.comparativa_id,
      file.filename,
      file.size,
      file.extension,
      file.upload_date,
      file.download_url,
      file.preview_url,
    ]);

    await tursoClient.execute({
      sql: `
        INSERT INTO comparativa_files (
          id, comparativa_id, filename, size, extension, upload_date, download_url, preview_url
        ) VALUES ${placeholders}
      `,
      args: values,
    });

    const queryTime = performance.now() - startTime;
    console.log(
      `[PERFORMANCE] Files batch insert (${files.length} files): ${queryTime.toFixed(2)}ms`
    );

    return { success: true };
  } catch (error) {
    console.error("Error adding comparativa files:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

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
  request: NextRequest
): Promise<NextResponse<PaginatedComparisonsResponse>> {
  const startTime = performance.now();

  try {
    // Extract query parameters from URL
    const { searchParams } = new URL(request.url);

    // Parse query parameters (convert from URL params to original format)
    const rowsParam = searchParams.get("rowsPerPage");
    const rowsPerPageParsed: number | string =
      rowsParam === null
        ? 10
        : rowsParam === "Sin Límite"
          ? "Sin Límite"
          : Number(rowsParam);

    const requestData: PaginatedComparisonsRequest = {
      page: parseInt(searchParams.get("page") || "1"),
      rowsPerPage: rowsPerPageParsed,
      user_id: searchParams.get("user_id") || "",
      user_role: searchParams.get("user_role") || "",
      filterValue: searchParams.get("filterValue") || undefined,
      statusFilter: searchParams.get("statusFilter")
        ? JSON.parse(searchParams.get("statusFilter")!)
        : undefined,
      dateRange: searchParams.get("dateRange")
        ? JSON.parse(searchParams.get("dateRange")!)
        : undefined,
      userFilter: searchParams.get("userFilter")
        ? JSON.parse(searchParams.get("userFilter")!)
        : undefined,
      companyFilter: searchParams.get("companyFilter")
        ? JSON.parse(searchParams.get("companyFilter")!)
        : undefined,
    };

    // Validate request parameters (warn only for backward compatibility)
    const validationResult = PaginationQuerySchema.safeParse(requestData);
    if (!validationResult.success) {
      console.warn(
        "❌ Validation warnings for GET /new_api/comparisons:",
        validationResult.error.issues
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
    } = requestData;

    // Validate required parameters (maintaining original validation logic)
    if (!page || !rowsPerPage || !user_id || !user_role) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Initialize database client
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

    // Calculate pagination offset
    const offset =
      typeof rowsPerPage === "number" ? (page - 1) * rowsPerPage : 0;

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
                  c.company_id AS company_id,
                  c.tramite_id AS tramite_id,
                  CASE 
                    WHEN JSON_VALID(c.plan) THEN c.plan
                    ELSE JSON_ARRAY(c.plan)
                  END AS plan,
                  u.name AS user_name,
                  u.email AS user_email,
                  u.image AS user_image
              FROM comparativas c
              JOIN user u ON c.user_id = u.id`;

    const filters: string[] = [];
    const params: (string | number)[] = [];

    // Handle user role-based filtering (exact original logic)
    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        filters.push(
          `( c.user_id = ? OR c.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")}))`
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
      const toDate = new Date(dateRange.to);

      // Maintain original date adjustment logic
      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(creation_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    // Apply status and user filters
    if (statusFilter) addArrayFilter("c.status", statusFilter);
    if (userFilter) addArrayFilter("c.user_id", userFilter);
    if (companyFilter) addArrayFilter("c.company_id", companyFilter);

    // Build count query for pagination
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM comparativas c
      JOIN user u ON c.user_id = u.id
    `;

    // Apply filters to both queries
    if (filters.length > 0) {
      const whereClause = ` WHERE ` + filters.join(" AND ");
      query += whereClause;
      countQuery += whereClause;
    }

    // Execute count query
    const countResult = await tursoClient.execute({
      sql: countQuery,
      args: params,
    });
    const total = Number(countResult.rows[0]?.total) || 0;

    // Add GROUP BY (exact original implementation)
    query += ` GROUP BY c.id, c.creation_date, c.client, c.comision_sales_person_fijo, c.comision_sales_person_indexado, c.comision_fijo, c.comision_indexado, c.status, c.service, c.plan, u.name, u.email, u.image`;

    // Add ordering
    query += ` ORDER BY c.creation_date DESC`;

    // Add pagination
    if (typeof rowsPerPage === "number") {
      query += ` LIMIT ? OFFSET ?`;
      params.push(rowsPerPage, offset);
    }

    // Execute main query
    const queryStartTime = performance.now();
    const rs = await tursoClient.execute({
      sql: query,
      args: params,
    });
    const queryEndTime = performance.now();

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
      company_id: row.company_id as string | undefined,
      user: {
        name: row.user_name as string,
        email: row.user_email as string,
        image: row.user_image as string,
      },
    }));

    const endTime = performance.now();

    // Performance logging
    console.log(`✅ GET /new_api/comparisons executed successfully:`, {
      totalTime: `${(endTime - startTime).toFixed(2)}ms`,
      queryTime: `${(queryEndTime - queryStartTime).toFixed(2)}ms`,
      resultCount: transformedData.length,
      totalRecords: total,
      filtersApplied: filters.length,
    });

    // Return exact original response format
    return NextResponse.json({
      success: true,
      data: transformedData,
      total,
    });
  } catch (error) {
    const endTime = performance.now();
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
      { status: 500 }
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
  request: NextRequest
): Promise<
  NextResponse<ComparisonCreateResponse | PaginatedComparisonsResponse>
> {
  const startTime = performance.now();

  try {
    const contentType = request.headers.get("content-type");

    // Check if this is a FormData request (comparison creation)
    if (contentType?.includes("multipart/form-data")) {
      return await handleComparisonCreation(request, startTime);
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
      { status: 400 }
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
      { status: 500 }
    );
  }
}

/**
 * Handle comparison creation (FormData request)
 */
async function handleComparisonCreation(
  request: NextRequest,
  startTime: number
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
        { status: 500 }
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
        { status: 400 }
      );
    }

    // Parse JSON data (maintaining original parsing behavior)
    let comparativa: ComparativaDB;
    let comparativaFiles: ComparativaFile[];

    try {
      comparativa = JSON.parse(comparativaString);
      comparativaFiles = JSON.parse(documents);

      // Optional Zod validation for enhanced type safety (non-breaking)
      try {
        ComparativaSchema.parse(comparativa);
        z.array(ComparativaFileSchema).parse(comparativaFiles);
      } catch (zodError) {
        // Log validation warnings but don't break backward compatibility
        console.warn("Data validation warning:", zodError);
      }
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters", // Use original error message for consistency
        },
        { status: 400 }
      );
    }

    // Execute database operations (maintaining original logic flow)
    const comparativaResult = await addComparativaOptimized(
      comparativa,
      tursoClient
    );

    if (!comparativaResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: comparativaResult.error,
        },
        { status: 400 }
      );
    }

    if (comparativaFiles.length > 0) {
      const insertFilesResult = await addComparativaFilesOptimized(
        comparativaFiles,
        tursoClient
      );
      if (!insertFilesResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: insertFilesResult.error,
          },
          { status: 400 }
        );
      }
    }

    const totalTime = performance.now() - startTime;
    console.log(
      `✅ Comparison creation completed in ${totalTime.toFixed(2)}ms`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating comparison:", error);

    const totalTime = performance.now() - startTime;
    console.log(
      `❌ Comparison creation failed after ${totalTime.toFixed(2)}ms`
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle paginated request (backward compatibility with original POST endpoint)
 */
async function handlePaginatedRequest(
  request: NextRequest,
  requestData: PaginatedComparisonsRequest
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
