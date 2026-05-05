import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

const RenewableContractsRequestSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(1000).optional().default(500),
});

interface RenewableContract {
  id: string;
  sales_name: string;
  renovationDate: string;
}

interface RenewableContractsResponse {
  success: boolean;
  data?: RenewableContract[];
  total?: number;
  error?: string;
}

/**
 * Retrieves renewable contracts (tramites) based on user role and permissions.
 * Returns paginated "Activo" contracts eligible for renewal.
 *
 * Performance notes:
 * - Requires index: CREATE INDEX IF NOT EXISTS idx_tramites_status_renovation ON tramites(status, renovation_date);
 * - Count and data queries run in parallel via Promise.all
 */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<RenewableContractsResponse>> {
  try {
    const rawBody = await req.json();
    const validationResult = RenewableContractsRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 },
      );
    }

    const { id, role, page, limit } = validationResult.data;
    const offset = (page - 1) * limit;

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    // Build WHERE clause with role-based filtering.
    // Date range: 7 days before today to 60 days ahead, so expired contracts
    // don't crowd out current/upcoming ones within the limit.
    let whereClause = `WHERE status = ? AND renovation_date >= date('now', '-7 days') AND renovation_date <= date('now', '+60 days')`;
    const params: (string | number)[] = ["Activo"];

    if (role === "2") {
      try {
        const subcomerciales = await getSubcomerciales(tursoClient, id);
        if (
          subcomerciales.success &&
          subcomerciales.ids &&
          subcomerciales.ids.length > 0
        ) {
          const placeholders = subcomerciales.ids.map(() => "?").join(", ");
          whereClause += ` AND (user_id = ? OR user_id IN (${placeholders}))`;
          params.push(id, ...subcomerciales.ids);
        } else {
          whereClause += ` AND user_id = ?`;
          params.push(id);
        }
      } catch {
        whereClause += ` AND user_id = ?`;
        params.push(id);
      }
    }

    // Run count and data queries in parallel
    const countParams = [...params];
    const dataParams = [...params, limit, offset];

    const [countResult, dataResult] = await Promise.all([
      tursoClient.execute({
        sql: `SELECT COUNT(*) AS total FROM tramites ${whereClause}`,
        args: countParams,
      }),
      tursoClient.execute({
        sql: `
          SELECT id, sales_name, renovation_date AS renovationDate
          FROM tramites
          ${whereClause}
          ORDER BY renovation_date ASC
          LIMIT ? OFFSET ?
        `,
        args: dataParams,
      }),
    ]);

    const total = Number(countResult.rows[0]?.total) || 0;

    const renewableContracts: RenewableContract[] = dataResult.rows.map(
      (row) => ({
        id: row.id as string,
        sales_name: row.sales_name as string,
        renovationDate: row.renovationDate as string,
      }),
    );

    return NextResponse.json({
      success: true,
      data: renewableContracts,
      total,
    });
  } catch (error) {
    console.error("Error obtaining renewable contracts:", {
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      { success: false, error: "Error obteniendo trámites renovables" },
      { status: 500 },
    );
  }
}
