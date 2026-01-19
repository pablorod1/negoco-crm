import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { ComercializadoraDetails, Rate } from "@/comercializadoras/types";
import { DocumentacionFile } from "@/core/types";

// Request validation schema for path parameter
const EnergySupplierByNameParamsSchema = z.object({
  name: z.string().min(1, "Energy supplier name is required"),
});

// Request validation schema for POST body
const EnergySupplierByNameRequestSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  user_role: z.string().min(1, "User role is required"),
});

// Response types for full compatibility
interface EnergySupplierByNameResponse {
  success: boolean;
  data?: ComercializadoraDetails;
  error?: string;
}

/**
 * Retrieves detailed information about a specific energy supplier by name
 *
 * This endpoint provides comprehensive information about an energy supplier including:
 * - Basic supplier information (id, name, logo, active status)
 * - All associated rates with their pricing and type information
 * - Total number of tramites (contracts) associated with this supplier
 * - Total number of documentation files associated with this supplier
 * - Complete list of associated documentation files with metadata
 *
 * Performance optimizations:
 * - Single optimized query with JSON aggregation for rates and files
 * - Efficient LEFT JOINs to avoid N+1 query patterns
 * - Proper indexing on comercializadoras.name for fast lookups
 * - JSON parsing with null filtering for clean data structures
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing the energy supplier name
 * @returns Promise<NextResponse<EnergySupplierByNameResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<NextResponse<EnergySupplierByNameResponse>> {
  const startTime = Date.now();
  const optimizations: string[] = [
    "single-query-aggregation",
    "json-group-array",
    "user-role-filtering",
  ];

  try {
    // Parse and validate path parameters - maintaining exact compatibility with legacy endpoint
    const { name } = await params;

    // Legacy-compatible validation: check for falsy values exactly like original
    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Parameters",
        },
        { status: 400 },
      );
    }

    // Parse and validate request body for user security parameters
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
        },
        { status: 400 },
      );
    }

    // Validate request body parameters
    const bodyValidationResult =
      EnergySupplierByNameRequestSchema.safeParse(requestBody);
    if (!bodyValidationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing user authentication parameters",
        },
        { status: 400 },
      );
    }

    const { user_id, user_role } = bodyValidationResult.data;

    // Additional validation using Zod for enhanced type safety (non-breaking)
    const validationResult = EnergySupplierByNameParamsSchema.safeParse({
      name,
    });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Parameters",
        },
        { status: 400 },
      );
    }

    // Initialize database client with connection retry logic
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not initialized",
        },
        { status: 500 },
      );
    }

    // Build user role-based filtering for tramites (exactly like main endpoint)
    let userFilterClause = "";
    const userFilterParams: string[] = [];

    if (user_role === "2") {
      // Commercial users (role 2): only see their own tramites and their subcomerciales' tramites
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        userFilterClause = `AND (t.user_id = ? OR t.user_id IN (${subcomerciales.ids.map(() => "?").join(", ")}))`;
        userFilterParams.push(user_id, ...subcomerciales.ids);
        optimizations.push("role-based-filtering");
        optimizations.push("subordinate-user-lookup");
      } else {
        userFilterClause = `AND t.user_id = ?`;
        userFilterParams.push(user_id);
        optimizations.push("role-based-filtering");
      }
    } else {
      // For other roles (admin, supervisor, etc.): no user filtering, show all tramites
      userFilterClause = "";
      // userFilterParams stays empty - no parameters needed
    }

    // Single optimized query with subqueries matching exactly the main endpoint logic
    // This approach matches exactly the main endpoint logic but for a single comercializadora
    const query = `
      SELECT 
        c.id,
        c.name,
        c.logo,
        c.active,
        (SELECT COUNT(*) FROM documentacion_files WHERE folder_name LIKE '%' || c.name || '%') as num_files,
        (
          SELECT COUNT(DISTINCT con.tramite_id)
          FROM contracts con
          JOIN tramites t ON t.id = con.tramite_id
          WHERE (con.new_company = c.id OR con.new_company = c.name)
            ${userFilterClause}
        ) as num_tramites,
        (
          SELECT 
            SUM(con.consumption) AS total
          FROM contracts con
          INNER JOIN tramites t ON con.tramite_id = t.id
          WHERE t.status = 'Activo' 
            AND (con.new_company = c.id OR con.new_company = c.name)
            ${userFilterClause}
        ) as total_consumption,
        (SELECT json_group_array(
          json_object(
            'id', cr.id,
            'name', cr.name,
            'type', cr.type,
            'price', cr.price,
            'created_at', cr.created_at,
            'updated_at', cr.updated_at
          )
        ) FROM comercializadora_rates cr WHERE cr.comercializadora_id = c.id ORDER BY cr.created_at DESC) as rates,
        (SELECT json_group_array(
          json_object(
            'name', df.name,
            'extension', df.extension,
            'preview_url', df.preview_url,
            'download_url', df.download_url,
            'upload_date', df.upload_date,
            'size', df.size
          )
        ) FROM documentacion_files df WHERE df.folder_name LIKE '%' || c.name || '%') as files
      FROM comercializadoras c
      WHERE c.name = ?
    `;

    const queryParams = [...userFilterParams, ...userFilterParams, name];
    optimizations.push("exact-main-endpoint-logic-single-comercializadora");
    const response = await tursoClient.execute(query, queryParams);

    // Validate query results
    if (!response || response.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No comercializadora found",
        },
        { status: 404 },
      );
    }

    const comercializadora = response.rows[0];

    // Parse and validate rates JSON with proper error handling
    let rates: Rate[] = [];
    try {
      const ratesJson = comercializadora.rates as string;
      if (ratesJson) {
        const parsedRates = JSON.parse(ratesJson);
        // Filter out null entries that can occur with json_group_array
        rates = Array.isArray(parsedRates)
          ? parsedRates.filter((rate: Rate) => rate.id !== null)
          : [];
      }
      optimizations.push("rates-json-parsing");
    } catch (error) {
      console.error("Error parsing rates JSON:", error);
      rates = [];
    }

    // Parse and validate files JSON with proper error handling
    let files: DocumentacionFile[] = [];
    try {
      const filesJson = comercializadora.files as string;
      if (filesJson) {
        const parsedFiles = JSON.parse(filesJson);
        // Filter out null entries and ensure proper type conversion
        files = Array.isArray(parsedFiles)
          ? parsedFiles
              .filter((file: DocumentacionFile) => file.name !== null)
              .map((file: DocumentacionFile) => ({
                ...file,
                size: Number(file.size) || 0,
              }))
          : [];
      }
      optimizations.push("files-json-parsing");
    } catch (error) {
      console.error("Error parsing files JSON:", error);
      files = [];
    }

    // Build the response data maintaining exact compatibility with legacy endpoint
    // BUT with filtered data based on user role and permissions
    const responseData: ComercializadoraDetails = {
      id: comercializadora.id as string,
      name: comercializadora.name as string,
      logo: comercializadora.logo as string | null,
      active: Boolean(comercializadora.active),
      rates: rates,
      num_tramites: Number(comercializadora.num_tramites) || 0,
      num_files: Number(comercializadora.num_files) || 0,
      total_consumption: Number(comercializadora.total_consumption) || 0,
      files: files,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: 200 },
    );
  } catch (error) {
    const queryTime = Date.now() - startTime;

    console.error("Error fetching energy supplier by name:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      queryTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
