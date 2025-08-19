import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { FotovoltaicaDB, FotovoltaicaFile } from "@/fotovoltaica/types";
import { DateRange } from "react-day-picker";
import {
  addFotovoltaica,
  addFotovoltaicaFiles,
} from "@/fotovoltaica/utils/addFotovoltaicaHelpers";
import {
  FotovoltaicaSchema,
  FotovoltaicaFileSchema,
} from "@/fotovoltaica/schemas";

/**
 * Types for Paginated Solar Installations (POST endpoint for compatibility)
 */
interface PaginatedSolarInstallationsRequest {
  page: number;
  rowsPerPage: number | string;
  user_id: string;
  user_role: string;
  filterValue?: string;
  statusFilter?: string[];
  activationDateRange?: DateRange | undefined;
  creationDateRange?: DateRange | undefined;
  userFilter?: string[];
  typeFilter?: string[];
}

interface SolarInstallationResponseItem {
  id: string;
  client: string;
  client_type: string;
  location: string;
  coordinates: string[];
  type: string;
  notes: Record<string, unknown>[];
  internal_notes: Record<string, unknown>[];
  user_id: string;
  creation_date: string;
  status: string;
  comision: number;
  comision_sales_person: number;
  user: {
    name: string;
    email: string;
  };
  activation_date: string | null;
}

interface PaginatedSolarInstallationsResponse {
  success: boolean;
  data?: SolarInstallationResponseItem[];
  total?: number;
  error?: string;
}

/**
 * Zod validation schemas for request validation
 */
const PaginationRequestSchema = z.object({
  page: z.number().positive(),
  rowsPerPage: z.union([z.number().positive(), z.literal("Sin Límite")]),
  user_id: z.string().min(1),
  user_role: z.string().min(1),
  filterValue: z.string().optional(),
  statusFilter: z.array(z.string()).optional(),
  activationDateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
  creationDateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
  userFilter: z.array(z.string()).optional(),
  typeFilter: z.array(z.string()).optional(),
});

/**
 * Retrieves paginated solar installations with advanced filtering
 * Maintains 100% compatibility with legacy /api/fotovoltaica/get/paginated-fotovoltaicas
 *
 * @param request - Next.js request object with pagination and filter parameters
 * @returns Promise<NextResponse<PaginatedSolarInstallationsResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<PaginatedSolarInstallationsResponse>> {
  const startTime = performance.now();

  try {
    // Parse request body - maintaining exact compatibility with legacy endpoint
    const requestData: PaginatedSolarInstallationsRequest =
      await request.json();

    // Validate request parameters (warn only for backward compatibility)
    const validationResult = PaginationRequestSchema.safeParse(requestData);
    if (!validationResult.success) {
      console.warn(
        "❌ Validation warnings for POST /new_api/solar-installations:",
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
      activationDateRange,
      creationDateRange,
      userFilter,
      typeFilter,
    } = requestData;

    // Validate required parameters (maintaining original validation logic)
    if (!page || !rowsPerPage || !user_id || !user_role) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    // Initialize database client
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Calculate pagination offset - exact same logic as legacy
    const offset =
      rowsPerPage === "Sin Límite"
        ? 0
        : typeof rowsPerPage === "number"
          ? (page - 1) * rowsPerPage
          : 0;

    // Initialize dynamic filters and parameters
    const filters: string[] = [];
    const params: (string | number)[] = [];

    // User role-based filtering - exact same logic as legacy
    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        filters.push(
          `(f.user_id = ? OR f.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")}))`
        );
        params.push(user_id, ...subcomerciales.ids);
      } else {
        filters.push(`f.user_id = ?`);
        params.push(user_id);
      }
    } else {
      // For other roles: apply userFilter if provided, otherwise show all non-draft tramites
      if (userFilter && userFilter.length > 0) {
        filters.push(
          `(f.user_id IN (${userFilter.map(() => "?").join(", ")}))`
        );
        params.push(...userFilter, user_id);
      }
    }

    // Helper function for text filtering - optimized for performance
    const addTextFilter = (fields: string[], value: string) => {
      const likeConditions = fields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      filters.push(`(${likeConditions})`);
      fields.forEach(() => params.push(`%${value}%`));
    };

    // Apply text filter if provided
    if (filterValue) {
      addTextFilter(["f.id", "f.client"], filterValue);
    }

    // Helper function for array-based filters - improved performance
    const addArrayFilter = (column: string, filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
        params.push(...filterArray);
      }
    };

    // Apply array filters
    addArrayFilter("f.status", statusFilter);
    addArrayFilter("f.type", typeFilter);

    // Date range filters - exact same logic as legacy
    if (
      activationDateRange &&
      activationDateRange.from &&
      activationDateRange.to
    ) {
      const fromDate = new Date(activationDateRange.from);
      const toDate = new Date(activationDateRange.to);

      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(activation_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    if (creationDateRange && creationDateRange.from && creationDateRange.to) {
      const fromDate = new Date(creationDateRange.from);
      const toDate = new Date(creationDateRange.to);

      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(creation_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    // Construct optimized base query with proper indexing hints
    let baseQuery = `
      FROM 
          fotovoltaica f
      JOIN
          user u ON f.user_id = u.id 
    `;

    // Add WHERE clause if filters exist
    if (filters.length > 0) {
      baseQuery += ` WHERE ` + filters.join(" AND ");
    }

    // Optimized count query
    const countQuery = `
      SELECT COUNT(DISTINCT f.id) AS total
      ${baseQuery}
    `;

    const limitQuery = `LIMIT ? OFFSET ?`;

    // Optimized main query with data retrieval
    const dataQuery = `
      SELECT 
          f.*,
          u.name AS user_name,
          u.email AS user_email
      ${baseQuery}
      GROUP BY 
          f.id
      ORDER BY f.creation_date DESC
      ${rowsPerPage === "Sin Límite" ? "" : typeof rowsPerPage === "number" ? limitQuery : ""}
    `;

    // Prepare parameters for both queries
    const countParams = [...params];
    const dataParams =
      typeof rowsPerPage === "number"
        ? [...params, rowsPerPage, offset]
        : [...params];

    // Execute optimized count query with prepared statement
    const countResult = await tursoClient.execute({
      sql: countQuery,
      args: countParams,
    });
    const total = countResult.rows[0]?.total || 0;

    // Execute optimized data query with prepared statement
    const rs = await tursoClient.execute({
      sql: dataQuery,
      args: dataParams,
    });

    // Performance logging
    const executionTime = performance.now() - startTime;
    console.log(
      `🚀 Solar installations query executed in ${executionTime.toFixed(
        2
      )}ms for ${rs.rows.length} records`
    );

    // Process and return results with optimized parsing
    return NextResponse.json({
      success: true,
      data: rs.rows.map((row): SolarInstallationResponseItem => {
        const parseArray = (value: string | null) =>
          value ? value.split(",").filter(Boolean) : [];

        return {
          id: String(row.id || ""),
          client: String(row.client || ""),
          client_type: String(row.client_type || ""),
          location: String(row.location || ""),
          coordinates: parseArray(row.coordinates as string | null),
          type: String(row.type || ""),
          notes: JSON.parse((row.notes as string) || "[]"),
          internal_notes: JSON.parse((row.internal_notes as string) || "[]"),
          user_id: String(row.user_id || ""),
          creation_date: String(row.creation_date || ""),
          status: String(row.status || ""),
          comision: Number(row.comision) || 0,
          comision_sales_person: Number(row.comision_sales_person) || 0,
          user: {
            name: String(row.user_name || ""),
            email: String(row.user_email || ""),
          },
          activation_date: row.activation_date
            ? String(row.activation_date)
            : null,
        };
      }),
      total: Number(total) || 0,
    });
  } catch (error) {
    console.error(
      "Error en el servidor obteniendo las solicitudes de placas solares",
      error
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "Error en el servidor obteniendo las solicitudes de placas solares",
      },
      { status: 500 }
    );
  }
}

/**
 * Creates a new solar installation with associated files
 * Maintains 100% compatibility with legacy /api/fotovoltaica/add endpoint
 *
 * @param request - Next.js request object containing FormData with fotovoltaica and files
 * @returns Promise<NextResponse>
 */
export async function PUT(request: NextRequest) {
  const startTime = performance.now();
  try {
    const formData = await request.formData();
    const fotovoltaicaString = formData.get("fotovoltaica") as string;
    const documents = formData.get("files") as string;

    if (!fotovoltaicaString || !documents) {
      return NextResponse.json(
        { success: false, error: "Parámetros faltantes" },
        { status: 400 }
      );
    }

    // Validate payload using Zod
    let fotovoltaica: FotovoltaicaDB;
    let fotovoltaicaFiles: FotovoltaicaFile[];
    try {
      fotovoltaica = FotovoltaicaSchema.parse(
        JSON.parse(fotovoltaicaString)
      ) as FotovoltaicaDB;
      fotovoltaicaFiles = z
        .array(FotovoltaicaFileSchema)
        .parse(JSON.parse(documents)) as FotovoltaicaFile[];
    } catch (validationError) {
      console.error(
        "Validation error (PUT /solar-installations):",
        validationError
      );
      return NextResponse.json(
        { success: false, error: "Formato de datos inválido" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Start atomic transaction
    const tx = await tursoClient.transaction();
    try {
      const fotovoltaicaResult = await addFotovoltaica(fotovoltaica, tx);
      if (!fotovoltaicaResult.success)
        throw new Error(fotovoltaicaResult.error);

      if (fotovoltaicaFiles.length > 0) {
        const insertFilesResult = await addFotovoltaicaFiles(
          fotovoltaicaFiles,
          tx
        );
        if (!insertFilesResult.success)
          throw new Error(insertFilesResult.error);
      }

      await tx.commit();

      const totalTime = performance.now() - startTime;
      console.log(
        `✅ Solar installation created in ${totalTime.toFixed(2)}ms with ${fotovoltaicaFiles.length} file(s)`
      );

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
      await tx.rollback();
      const message =
        e instanceof Error ? e.message : "Error creando la solicitud";
      const status = message.toLowerCase().includes("constraint") ? 409 : 500;
      return NextResponse.json({ success: false, error: message }, { status });
    }
  } catch (error) {
    console.error("Internal server error (PUT /solar-installations):", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
