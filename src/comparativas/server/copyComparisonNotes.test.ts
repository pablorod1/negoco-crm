// @vitest-environment node
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  COMPARISON_NOTE_SUBJECT,
  copyComparisonNotesToTramite,
} from "./copyComparisonNotes";

let db: Client;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE ticket_types(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    INSERT INTO ticket_types VALUES (1,'note'), (2,'incidencia');
    CREATE TABLE tickets(
      id TEXT PRIMARY KEY, subject TEXT NOT NULL, message TEXT NOT NULL,
      is_internal BOOLEAN NOT NULL DEFAULT 0, status_id INTEGER NOT NULL,
      type_id INTEGER NOT NULL, context TEXT NOT NULL, ref_id TEXT NOT NULL,
      priority TEXT DEFAULT 'medium', created_by TEXT NOT NULL, assigned_to TEXT,
      created_at DATETIME, updated_at DATETIME
    );
  `);
});

afterEach(() => db.close());

async function seed(ticket: Record<string, unknown> = {}) {
  const row = {
    id: crypto.randomUUID(),
    subject: "Nota Rápida",
    message: "Cliente sin luz desde el martes",
    is_internal: 0,
    status_id: 1,
    type_id: 1,
    context: "comparativa",
    ref_id: "COMP-1",
    priority: "medium",
    created_by: "owner",
    assigned_to: "owner",
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
    ...ticket,
  };
  await db.execute({
    sql: `INSERT INTO tickets (id, subject, message, is_internal, status_id, type_id,
            context, ref_id, priority, created_by, assigned_to, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: Object.values(row) as (string | number)[],
  });
  return row;
}

async function tramiteTickets() {
  const { rows } = await db.execute(
    "SELECT * FROM tickets WHERE context = 'tramite' AND ref_id = 'TR-1' ORDER BY created_at ASC",
  );
  return rows;
}

describe("copyComparisonNotesToTramite", () => {
  test("copia las notas públicas e internas conservando autor, fecha y visibilidad", async () => {
    await seed({ message: "Pública", created_at: "2026-09-01T10:00:00.000Z" });
    await seed({
      message: "Interna",
      is_internal: 1,
      created_by: "admin",
      priority: "high",
      created_at: "2026-09-02T10:00:00.000Z",
    });

    expect(await copyComparisonNotesToTramite(db, "COMP-1", "TR-1")).toBe(2);

    const copies = await tramiteTickets();
    expect(copies.map((row) => row.message)).toEqual(["Pública", "Interna"]);
    expect(copies.map((row) => Number(row.is_internal))).toEqual([0, 1]);
    expect(copies.map((row) => row.created_by)).toEqual(["owner", "admin"]);
    expect(copies.map((row) => row.created_at)).toEqual([
      "2026-09-01T10:00:00.000Z",
      "2026-09-02T10:00:00.000Z",
    ]);
    expect(copies.map((row) => row.priority)).toEqual(["medium", "high"]);
    expect(copies.every((row) => row.subject === COMPARISON_NOTE_SUBJECT)).toBe(
      true,
    );
  });

  test("las copias son tickets nuevos y la comparativa conserva sus notas", async () => {
    const original = await seed();

    await copyComparisonNotesToTramite(db, "COMP-1", "TR-1");

    const [copy] = await tramiteTickets();
    expect(copy.id).not.toBe(original.id);
    const { rows: source } = await db.execute(
      "SELECT id FROM tickets WHERE context = 'comparativa' AND ref_id = 'COMP-1'",
    );
    expect(source.map((row) => row.id)).toEqual([original.id]);
  });

  test("ignora los tickets que no son notas y las notas de otras comparativas", async () => {
    await seed({ type_id: 2, subject: "Incidencia", message: "No copiar" });
    await seed({ ref_id: "COMP-2", message: "De otra comparativa" });
    await seed({ message: "Sí copiar" });

    expect(await copyComparisonNotesToTramite(db, "COMP-1", "TR-1")).toBe(1);
    expect((await tramiteTickets()).map((row) => row.message)).toEqual([
      "Sí copiar",
    ]);
  });

  test("no escribe nada cuando la comparativa no tiene notas", async () => {
    expect(await copyComparisonNotesToTramite(db, "COMP-1", "TR-1")).toBe(0);
    expect(await tramiteTickets()).toEqual([]);
  });
});
