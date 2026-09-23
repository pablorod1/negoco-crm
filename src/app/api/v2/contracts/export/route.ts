import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import {
  executeReadWithRetry,
  isRetryableLibsqlError,
} from "@/core/libsql/executeWithRetry";
import { validateUserSession } from "@/core/auth/session-utils";
import {
  buildContractBaseQuery,
  buildContractFilters,
  buildContractHydrationQuery,
  mapContractRow,
  parseContractFilterParams,
} from "@/core/libsql/contracts/contractFilters";
import {
  formatQuickNoteForExcel,
  parseLegacyNotesForExcel,
} from "@/tramites/utils/excel-notes";

/**
 * GET /api/v2/contracts/export
 *
 * Returns every tramite matching the active table filters (not just the current
 * page) so the Excel export mirrors what the user has filtered, plus an optional
 * "Notas" column built from quick-note tickets and older notes stored on tramites.
 *
 * Cost/safety notes:
 * - Hard capped at MAX_EXPORT_ROWS. Over the cap we refuse instead of truncating,
 *   so nobody walks away with a partial file that looks complete.
 * - Hydration is chunked: GROUP_CONCAT never runs over more than CHUNK_SIZE
 *   tramites at a time, which is the SQLITE_NOMEM guard the paginated endpoint
 *   documents.
 * - Notes are fetched with one query per chunk. Wants an index on
 *   tickets(context, ref_id) — see migrations/013.
 */

const MAX_EXPORT_ROWS = 5000;
const CHUNK_SIZE = 500;

interface QuickNote {
  ref_id: string;
  message: string;
  created_at: string;
  author: string | null;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export async function GET(request: NextRequest) {
  try {
    // Exports are admin-only: the button is hidden for every other role in the
    // UI, and the payload can carry internal notes, so enforce it server-side too.
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = authResult.user;
    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const includeNotes = searchParams.get("includeNotes") === "true";

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const { filters, params, needsContractsJoin, needsClientsJoin } =
      await buildContractFilters(tursoClient, {
        ...parseContractFilterParams(searchParams),
        user_id: user.id,
        user_role: user.role,
      });

    const baseQuery = buildContractBaseQuery({
      filters,
      needsClientsJoin,
      needsContractsJoin,
    });

    const countQuery = needsContractsJoin
      ? `SELECT COUNT(*) AS total FROM (SELECT t.id ${baseQuery} GROUP BY t.id) sub`
      : `SELECT COUNT(*) AS total ${baseQuery}`;

    const countResult = await executeReadWithRetry(tursoClient, {
      sql: countQuery,
      args: [...params],
    });
    const total = Number(countResult.rows[0]?.total || 0);

    // Refuse rather than truncate: a silently partial Excel is worse than none.
    if (total > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: "TOO_MANY_ROWS",
          total,
          limit: MAX_EXPORT_ROWS,
        },
        { status: 413 },
      );
    }

    const idsQuery = `
      SELECT t.id
      ${baseQuery}
      ${needsContractsJoin ? "GROUP BY t.id" : ""}
      ORDER BY t.creation_date DESC, t.id DESC
      LIMIT ?
    `;

    const idsResult = await executeReadWithRetry(tursoClient, {
      sql: idsQuery,
      args: [...params, MAX_EXPORT_ROWS],
    });
    const ids = idsResult.rows.map((r) => String(r.id));

    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: [], total: 0 });
    }

    const idChunks = chunk(ids, CHUNK_SIZE);

    // Hydrate sequentially: parallel chunks would multiply peak DB memory,
    // which is precisely what the chunking exists to avoid.
    const rows: ReturnType<typeof mapContractRow>[] = [];
    const legacyNotesByTramite = new Map<string, string[]>();
    for (const idChunk of idChunks) {
      const dataResult = await executeReadWithRetry(tursoClient, {
        sql: buildContractHydrationQuery(idChunk.length, includeNotes),
        args: idChunk,
      });
      for (const row of dataResult.rows) {
        const contract = mapContractRow(
          row as unknown as Record<string, unknown>,
        );
        rows.push(contract);
        if (includeNotes) {
          legacyNotesByTramite.set(contract.id, [
            ...parseLegacyNotesForExcel(row.legacy_notes),
            ...parseLegacyNotesForExcel(row.legacy_internal_notes, true),
          ]);
        }
      }
    }

    let notesByTramite = new Map<string, QuickNote[]>();
    if (includeNotes) {
      notesByTramite = await fetchQuickNotes(tursoClient, idChunks);
    }

    const data = rows.map((row) => ({
      ...row,
      notes: includeNotes
        ? [
            ...(legacyNotesByTramite.get(row.id) ?? []),
            (notesByTramite.get(row.id) ?? [])
              .map(formatQuickNoteForExcel)
              .join("\n"),
          ]
            .filter(Boolean)
            .join("\n")
        : undefined,
    }));

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    if (isRetryableLibsqlError(error)) {
      console.warn("Turso unavailable exporting contracts:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Base de datos no disponible, inténtalo de nuevo",
        },
        { status: 503 },
      );
    }

    console.error("Error exportando trámites:", error);
    return NextResponse.json(
      { success: false, error: "Error en el servidor exportando los trámites" },
      { status: 500 },
    );
  }
}

/**
 * Loads quick notes (tickets of type "note") for the given tramite ids,
 * oldest first, grouped by tramite. Internal notes are included: only
 * admins reach this endpoint.
 */
async function fetchQuickNotes(
  tursoClient: NonNullable<ReturnType<typeof getTursoClient>>,
  idChunks: string[][],
): Promise<Map<string, QuickNote[]>> {
  const notesByTramite = new Map<string, QuickNote[]>();

  for (const idChunk of idChunks) {
    const placeholders = idChunk.map(() => "?").join(", ");
    const notesResult = await executeReadWithRetry(tursoClient, {
      sql: `
        SELECT
          tk.ref_id AS ref_id,
          tk.message AS message,
          tk.created_at AS created_at,
          u.name AS author
        FROM tickets tk
        INNER JOIN ticket_types tt ON tt.id = tk.type_id
        LEFT JOIN user u ON u.id = tk.created_by
        WHERE tk.context = 'tramite'
          AND tt.name = 'note'
          AND tk.ref_id IN (${placeholders})
        ORDER BY tk.created_at ASC
      `,
      args: idChunk,
    });

    for (const row of notesResult.rows) {
      const refId = String(row.ref_id);
      const existing = notesByTramite.get(refId);
      const note: QuickNote = {
        ref_id: refId,
        message: String(row.message ?? ""),
        created_at: String(row.created_at ?? ""),
        author: row.author ? String(row.author) : null,
      };
      if (existing) {
        existing.push(note);
      } else {
        notesByTramite.set(refId, [note]);
      }
    }
  }

  return notesByTramite;
}
