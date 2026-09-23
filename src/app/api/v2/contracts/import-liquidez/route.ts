import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  canAccessInternal,
  validateUserSession,
} from "@/core/auth/session-utils";
import {
  formatQuickNoteForExcel,
  getNewExcelNotes,
  parseLegacyNotesForExcel,
  type QuickNoteForExcel,
} from "@/tramites/utils/excel-notes";

const StatusSchema = z.enum([
  "Pendiente de Cobro",
  "Cobrado por Comercializadora",
  "Pagado al Comercial",
  "Adelantado",
  "Pendiente de Descontar",
  "Descontado",
]);

const PreviewSchema = z.object({
  mode: z.literal("preview"),
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        notes: z.array(z.string().max(50000)).max(100),
      }),
    )
    .min(1)
    .max(500),
});

const ApplySchema = z.object({
  mode: z.literal("apply"),
  status: StatusSchema.nullable(),
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        notes: z
          .array(
            z.object({
              message: z.string().trim().min(1).max(50000),
              isInternal: z.boolean(),
            }),
          )
          .max(100),
      }),
    )
    .min(1)
    .max(50)
    .refine(
      (updates) =>
        new Set(updates.map((update) => update.id)).size === updates.length,
      "Los trámites no pueden estar duplicados",
    ),
});

const RequestSchema = z.discriminatedUnion("mode", [
  PreviewSchema,
  ApplySchema,
]);

export async function POST(request: NextRequest) {
  try {
    const auth = await validateUserSession(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos de importación inválidos." },
        { status: 400 },
      );
    }

    const client = getTursoClient(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Error al conectar con la base de datos." },
        { status: 500 },
      );
    }

    const { updates } = parsed.data;
    if (
      parsed.data.mode === "apply" &&
      !canAccessInternal(auth.user.role) &&
      parsed.data.updates.some((update) =>
        update.notes.some((note) => note.isInternal),
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No tienes permiso para crear notas internas.",
        },
        { status: 403 },
      );
    }
    const ids = updates.map((update) => update.id);
    const placeholders = ids.map(() => "?").join(",");
    const current = await client.execute({
      sql: `SELECT id, liquidez_status, notes, internal_notes FROM tramites WHERE id IN (${placeholders})`,
      args: ids,
    });
    if (current.rows.length !== ids.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Algún trámite ya no existe. Vuelve a validar el Excel.",
        },
        { status: 409 },
      );
    }

    const existingById = new Map(
      current.rows.map((row) => [String(row.id), row]),
    );
    const noteRows = updates.some((update) => update.notes.length > 0)
      ? await client.execute({
          sql: `SELECT tk.ref_id, tk.message, tk.created_at, u.name AS author
                FROM tickets tk
                JOIN ticket_types tt ON tt.id = tk.type_id
                LEFT JOIN user u ON u.id = tk.created_by
                WHERE tk.context = 'tramite' AND tt.name = 'note'
                  ${canAccessInternal(auth.user.role) ? "" : "AND tk.is_internal = 0"}
                  AND tk.ref_id IN (${placeholders})
                ORDER BY tk.created_at ASC`,
          args: ids,
        })
      : { rows: [] };

    const quickNotesById = new Map<string, QuickNoteForExcel[]>();
    for (const row of noteRows.rows) {
      const id = String(row.ref_id);
      const notes = quickNotesById.get(id) ?? [];
      notes.push({
        message: String(row.message ?? ""),
        created_at: String(row.created_at ?? ""),
        author: row.author ? String(row.author) : null,
      });
      quickNotesById.set(id, notes);
    }

    const notesById: Record<string, string[]> = Object.create(null);
    const notesToCreate: {
      id: string;
      message: string;
      isInternal: boolean;
    }[] = [];
    for (const update of updates) {
      const existing = existingById.get(update.id)!;
      const quickNotes = quickNotesById.get(update.id) ?? [];
      const exportedLines = [
        ...parseLegacyNotesForExcel(existing.notes),
        ...(canAccessInternal(auth.user.role)
          ? parseLegacyNotesForExcel(existing.internal_notes, true)
          : []),
        ...quickNotes.map(formatQuickNoteForExcel),
      ];
      const existingMessages = quickNotes.map((note) => note.message);
      if (parsed.data.mode === "preview") {
        notesById[update.id] = getNewExcelNotes(
          update.notes as string[],
          exportedLines,
          existingMessages,
        );
      } else {
        const selectedNotes = update.notes as {
          message: string;
          isInternal: boolean;
        }[];
        const newMessages = new Set(
          getNewExcelNotes(
            selectedNotes.map((note) => note.message),
            exportedLines,
            existingMessages,
          ),
        );
        const seen = new Set<string>();
        notesToCreate.push(
          ...selectedNotes
            .filter((note) => {
              if (!newMessages.has(note.message) || seen.has(note.message))
                return false;
              seen.add(note.message);
              return true;
            })
            .map((note) => ({
              id: update.id,
              message: note.message,
              isInternal: note.isInternal,
            })),
        );
      }
    }

    if (parsed.data.mode === "preview") {
      return NextResponse.json({ success: true, notesById });
    }

    const { status } = parsed.data;

    const now = new Date().toISOString();
    const statusChangeIds = status
      ? ids.filter((id) => existingById.get(id)?.liquidez_status !== status)
      : [];

    let noteTypeId: number | null = null;
    if (notesToCreate.length > 0) {
      const type = await client.execute(
        "SELECT id FROM ticket_types WHERE name = 'note'",
      );
      if (!type.rows[0]) {
        return NextResponse.json(
          {
            success: false,
            error: "El tipo de ticket para notas no está disponible.",
          },
          { status: 500 },
        );
      }
      noteTypeId = Number(type.rows[0].id);
    }

    const statements: { sql: string; args: (string | number)[] }[] = [];
    if (status && statusChangeIds.length > 0) {
      const fields = ["liquidez_status = ?"];
      const args: (string | number)[] = [status];
      if (status === "Cobrado por Comercializadora") {
        fields.push("collection_date = ?");
        args.push(now);
      } else if (status === "Pagado al Comercial" || status === "Adelantado") {
        fields.push("payment_date = ?");
        args.push(now);
      }
      statements.push({
        sql: `UPDATE tramites SET ${fields.join(", ")} WHERE id IN (${statusChangeIds.map(() => "?").join(",")})`,
        args: [...args, ...statusChangeIds],
      });
    }
    statements.push(
      ...notesToCreate.map(({ id, message, isInternal }) => ({
        sql: `INSERT INTO tickets (
          id, subject, message, is_internal, status_id, type_id,
          context, ref_id, priority, created_by, assigned_to, created_at, updated_at
        ) VALUES (?, 'Nota Rápida', ?, ?, 1, ?, 'tramite', ?, 'medium', ?, NULL, ?, ?)`,
        args: [
          crypto.randomUUID(),
          message,
          isInternal ? 1 : 0,
          noteTypeId!,
          id,
          auth.user!.id,
          now,
          now,
        ],
      })),
    );
    if (statements.length > 0) await client.batch(statements, "write");

    return NextResponse.json({
      success: true,
      processed: ids.length,
      updated: statusChangeIds.length,
      changedIds: statusChangeIds,
      notesAdded: notesToCreate.length,
    });
  } catch (error) {
    console.error("Error importando liquidez y notas:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar los trámites y sus notas.",
      },
      { status: 500 },
    );
  }
}
