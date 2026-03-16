import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";

/**
 * GET /api/v2/contracts/[id]/renewal-history
 *
 * Returns the renewal history for a specific tramite from tramite_renewal_history table.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: tramiteId } = await params;

    if (!tramiteId) {
      return NextResponse.json(
        { success: false, error: "Missing tramite ID" },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const result = await tursoClient.execute({
      sql: `SELECT
              rh.id,
              rh.tramite_id,
              rh.renewal_number,
              rh.user_id,
              rh.previous_activation_date,
              rh.previous_renovation_date,
              rh.new_activation_date,
              rh.new_renovation_date,
              rh.previous_status,
              rh.previous_liquidez_status,
              rh.company_changed,
              rh.previous_company,
              rh.new_company,
              rh.created_at,
              u.name AS user_name
            FROM tramite_renewal_history rh
            LEFT JOIN user u ON rh.user_id = u.id
            WHERE rh.tramite_id = ?
            ORDER BY rh.renewal_number DESC`,
      args: [tramiteId],
    });

    const data = result.rows.map((row) => ({
      id: row.id as string,
      tramite_id: row.tramite_id as string,
      renewal_number: row.renewal_number as number,
      user_id: row.user_id as string | null,
      previous_activation_date: row.previous_activation_date as string | null,
      previous_renovation_date: row.previous_renovation_date as string | null,
      new_activation_date: row.new_activation_date as string,
      new_renovation_date: row.new_renovation_date as string,
      previous_status: row.previous_status as string | null,
      previous_liquidez_status: row.previous_liquidez_status as string | null,
      company_changed: Boolean(row.company_changed),
      previous_company: row.previous_company as string | null,
      new_company: row.new_company as string | null,
      created_at: row.created_at as string,
      user_name: row.user_name as string | null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[ERROR] Renewal history fetch failed:", error);
    return NextResponse.json(
      { success: false, error: "Error fetching renewal history" },
      { status: 500 },
    );
  }
}
