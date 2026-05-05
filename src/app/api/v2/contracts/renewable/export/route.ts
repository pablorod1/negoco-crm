import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

const ExportRequestSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
  // Calendar month to export: 1-indexed
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000),
});

interface ExportContract {
  id: string;
  sales_name: string;
  renovationDate: string;
  activationDate: string;
  comercial: string;
  client_fullname: string;
  company: string;
  cups: string;
}

interface ExportResponse {
  success: boolean;
  data?: ExportContract[];
  error?: string;
}

/**
 * Returns full-month renewable contracts with extended data for Excel export.
 * Joins user (comercial), clients (client_fullname), and contracts (company, CUPS).
 * No pagination — the date window is bounded to a single calendar month.
 *
 * Performance notes:
 * - Relies on idx_tramites_status_renovation (status, renovation_date)
 * - LEFT JOINs are safe: tramites without a matching contract still appear
 */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<ExportResponse>> {
  try {
    const rawBody = await req.json();
    const validationResult = ExportRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Parámetros inválidos" },
        { status: 400 },
      );
    }

    const { id, role, month, year } = validationResult.data;

    // startDate = first day of the selected month.
    // endDate = 60 days past month end — mirrors the calendar's 60-day lookahead so
    // every tramite visible in any day's popover during this month is included.
    // Both bounds use plain YYYY-MM-DD so substr(renovation_date,1,10) can compare
    // correctly regardless of whether the stored value is an ISO datetime or a plain date.
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDateObj = new Date(year, month - 1 + 1, 0); // last day of month
    endDateObj.setDate(endDateObj.getDate() + 60); // +60 days
    const endDate = endDateObj.toISOString().slice(0, 10);

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    // Use substr() to normalize both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS.mmmZ" formats
    // before comparing — ISO datetimes stored with a time suffix are lexicographically
    // greater than a plain date string for the same day, which would break the upper bound.
    let whereClause = `WHERE t.status = ? AND substr(t.renovation_date, 1, 10) >= ? AND substr(t.renovation_date, 1, 10) <= ?`;
    const params: (string | number)[] = ["Activo", startDate, endDate];

    if (role === "2") {
      try {
        const subcomerciales = await getSubcomerciales(tursoClient, id);
        if (
          subcomerciales.success &&
          subcomerciales.ids &&
          subcomerciales.ids.length > 0
        ) {
          const placeholders = subcomerciales.ids.map(() => "?").join(", ");
          whereClause += ` AND (t.user_id = ? OR t.user_id IN (${placeholders}))`;
          params.push(id, ...subcomerciales.ids);
        } else {
          whereClause += ` AND t.user_id = ?`;
          params.push(id);
        }
      } catch {
        whereClause += ` AND t.user_id = ?`;
        params.push(id);
      }
    }

    const result = await tursoClient.execute({
      sql: `
        SELECT
          t.id,
          t.sales_name,
          t.renovation_date  AS renovationDate,
          t.activation_date  AS activationDate,
          COALESCE(u.name, '')                              AS comercial,
          COALESCE(cl.name || ' ' || cl.last_name, '')     AS client_fullname,
          COALESCE(co.name, c.new_company, '')              AS company,
          COALESCE(c.CUPS, '')                              AS cups
        FROM tramites t
        LEFT JOIN user             u  ON u.id  = t.user_id
        LEFT JOIN clients          cl ON cl.id = t.client_id
        LEFT JOIN contracts        c  ON c.tramite_id = t.id
        LEFT JOIN comercializadoras co ON co.id = c.new_company
        ${whereClause}
        ORDER BY t.renovation_date ASC
      `,
      args: params,
    });

    const data: ExportContract[] = result.rows.map((row) => ({
      id: row.id as string,
      sales_name: row.sales_name as string,
      renovationDate: row.renovationDate as string,
      activationDate: row.activationDate as string,
      comercial: row.comercial as string,
      client_fullname: row.client_fullname as string,
      company: row.company as string,
      cups: row.cups as string,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error exporting renewable contracts:", {
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      { success: false, error: "Error exportando trámites renovables" },
      { status: 500 },
    );
  }
}
