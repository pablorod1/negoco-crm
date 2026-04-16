import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { Row } from "@libsql/client";

interface DocumentsResponse {
  success: boolean;
  message?: string;
  data?: Row[];
}

/**
 * Shared handler for retrieving client document files.
 *
 * Optimization notes:
 * - Uses IN subquery instead of INNER JOIN. In SQLite the planner can
 *   short-circuit the outer scan when the subquery returns zero rows,
 *   avoiding a full tramite_files table scan for clients with no tramites.
 * - Requires indexes for best performance:
 *     CREATE INDEX IF NOT EXISTS idx_tramites_client_id ON tramites(client_id);
 *     CREATE INDEX IF NOT EXISTS idx_tramite_files_tramite_id ON tramite_files(tramite_id);
 */
async function getClientDocuments(
  request: NextRequest,
  clientId: string,
): Promise<NextResponse<DocumentsResponse>> {
  try {
    if (!clientId) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 },
      );
    }

    const result = await tursoClient.execute({
      sql: `
        SELECT
          tf.id, tf.tramite_id, tf.filename, tf.size,
          tf.extension, tf.upload_date, tf.download_url, tf.preview_url
        FROM tramite_files tf
        WHERE tf.tramite_id IN (SELECT id FROM tramites WHERE client_id = ?)
        GROUP BY tf.filename
        ORDER BY tf.upload_date DESC
      `,
      args: [clientId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No files found" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { success: true, data: result.rows },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Error obteniendo archivos de los trámites del cliente:",
      error,
    );
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<DocumentsResponse>> {
  const { id } = await params;
  return getClientDocuments(request, id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<DocumentsResponse>> {
  const { id } = await params;
  return getClientDocuments(request, id);
}
