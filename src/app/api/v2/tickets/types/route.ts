import { NextRequest } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";

/**
 * GET /api/v2/tickets/types
 *
 * Retrieves all available ticket types for dropdown/select components
 *
 * @returns List of ticket types with id, name, and description
 */
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const sessionResult = await validateUserSession(request);
    if (!sessionResult.user) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const tursoClient = getTursoClient(request);

    // Get all ticket types
    const result = await tursoClient.execute({
      sql: "SELECT id, name, description FROM ticket_types ORDER BY name",
      args: [],
    });

    const ticketTypes = result.rows.map((row) => ({
      id: row.id as number,
      name: row.name as string,
      description: row.description as string | null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: ticketTypes,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[TICKETS_TYPES_GET] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error interno del servidor",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
