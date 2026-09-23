import { createClient, type Client } from "@libsql/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { formatQuickNoteForExcel } from "@/tramites/utils/excel-notes";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
  canAccessInternal: (role: string) => role === "admin" || role === "1",
}));

let client: Client;
const existingDate = "2026-09-20T10:00:00.000Z";
const oldQuickNote = formatQuickNoteForExcel({
  message: "Nota anterior",
  created_at: existingDate,
  author: "Gerente",
});

const request = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/v2/contracts/import-liquidez", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

beforeEach(async () => {
  vi.clearAllMocks();
  client = createClient({ url: "file::memory:" });
  mocks.getTursoClient.mockReturnValue(client);
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: { id: "USER-1", name: "Gerente", role: "admin" },
  });
  await client.batch([
    "CREATE TABLE tramites (id TEXT PRIMARY KEY, liquidez_status TEXT, payment_date TEXT, collection_date TEXT, notes TEXT, internal_notes TEXT)",
    "INSERT INTO tramites (id, liquidez_status, notes, internal_notes) VALUES ('TR-1', 'Cobrado por Comercializadora', '[\"Nota legacy\"]', '[\"Nota privada\"]')",
    "CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT)",
    "INSERT INTO user (id, name) VALUES ('USER-1', 'Gerente')",
    "CREATE TABLE ticket_types (id INTEGER PRIMARY KEY, name TEXT)",
    "INSERT INTO ticket_types (id, name) VALUES (3, 'note')",
    `CREATE TABLE tickets (
      id TEXT PRIMARY KEY, subject TEXT, message TEXT CHECK(message <> 'FALLA'),
      is_internal INTEGER, status_id INTEGER, type_id INTEGER,
      context TEXT, ref_id TEXT, priority TEXT, created_by TEXT,
      assigned_to TEXT, created_at TEXT, updated_at TEXT
    )`,
    {
      sql: `INSERT INTO tickets (id, subject, message, is_internal, status_id, type_id,
      context, ref_id, priority, created_by, created_at, updated_at)
      VALUES ('NOTE-1', 'Nota Rápida', 'Nota anterior', 0, 1, 3,
      'tramite', 'TR-1', 'medium', 'USER-1', ?, ?)`,
      args: [existingDate, existingDate],
    },
  ]);
});

afterEach(() => client.close());

describe("importación de liquidez y notas", () => {
  test("detecta solo las líneas nuevas de un Excel exportado", async () => {
    const response = await request({
      mode: "preview",
      updates: [
        {
          id: "TR-1",
          notes: [
            `Nota legacy\n[Interna] Nota privada\n${oldQuickNote}\nPago parcial aprobado\nRevisar factura`,
          ],
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      notesById: { "TR-1": ["Pago parcial aprobado", "Revisar factura"] },
    });
    const tickets = await client.execute("SELECT id FROM tickets");
    expect(tickets.rows).toHaveLength(1);
  });

  test("actualiza el estado y crea notas públicas e internas sin duplicarlas al reintentar", async () => {
    const body = {
      mode: "apply",
      status: "Pagado al Comercial",
      updates: [
        {
          id: "TR-1",
          notes: [
            { message: "Pago parcial aprobado", isInternal: false },
            { message: "Revisar factura", isInternal: true },
          ],
        },
      ],
    };

    const first = await request(body);
    expect(await first.json()).toMatchObject({
      success: true,
      updated: 1,
      changedIds: ["TR-1"],
      notesAdded: 2,
    });
    const contract = await client.execute(
      "SELECT liquidez_status, payment_date, notes FROM tramites WHERE id = 'TR-1'",
    );
    expect(contract.rows[0].liquidez_status).toBe("Pagado al Comercial");
    expect(contract.rows[0].payment_date).toBeTruthy();
    expect(contract.rows[0].notes).toBe('["Nota legacy"]');
    const tickets = await client.execute(
      "SELECT message, is_internal FROM tickets WHERE id <> 'NOTE-1' ORDER BY message",
    );
    expect(tickets.rows).toMatchObject([
      { message: "Pago parcial aprobado", is_internal: 0 },
      { message: "Revisar factura", is_internal: 1 },
    ]);

    const second = await request(body);
    expect(await second.json()).toMatchObject({
      success: true,
      processed: 1,
      updated: 0,
      changedIds: [],
      notesAdded: 0,
    });
    expect((await client.execute("SELECT id FROM tickets")).rows).toHaveLength(
      3,
    );
  });

  test("añade notas aunque el estado ya coincida, sin cambiar la fecha de pago", async () => {
    await client.execute({
      sql: "UPDATE tramites SET liquidez_status = ?, payment_date = ? WHERE id = ?",
      args: ["Pagado al Comercial", "2026-09-01T00:00:00.000Z", "TR-1"],
    });
    const response = await request({
      mode: "apply",
      status: "Pagado al Comercial",
      updates: [
        {
          id: "TR-1",
          notes: [{ message: "Liquidación revisada", isInternal: false }],
        },
      ],
    });

    expect(await response.json()).toMatchObject({
      success: true,
      processed: 1,
      updated: 0,
      notesAdded: 1,
    });
    const contract = await client.execute(
      "SELECT payment_date FROM tramites WHERE id = 'TR-1'",
    );
    expect(contract.rows[0].payment_date).toBe("2026-09-01T00:00:00.000Z");
  });

  test("permite añadir notas sin elegir estado de liquidez", async () => {
    const response = await request({
      mode: "apply",
      status: null,
      updates: [
        {
          id: "TR-1",
          notes: [{ message: "Nota sin cambio", isInternal: false }],
        },
      ],
    });

    expect(await response.json()).toMatchObject({
      success: true,
      processed: 1,
      updated: 0,
      notesAdded: 1,
    });
    const contract = await client.execute(
      "SELECT liquidez_status FROM tramites WHERE id = 'TR-1'",
    );
    expect(contract.rows[0].liquidez_status).toBe(
      "Cobrado por Comercializadora",
    );
  });

  test("mantiene la importación de estado para un Excel sin notas nuevas", async () => {
    const response = await request({
      mode: "apply",
      status: "Pagado al Comercial",
      updates: [{ id: "TR-1", notes: [] }],
    });

    expect(await response.json()).toMatchObject({
      success: true,
      processed: 1,
      updated: 1,
      notesAdded: 0,
    });
    const contract = await client.execute(
      "SELECT liquidez_status, payment_date FROM tramites WHERE id = 'TR-1'",
    );
    expect(contract.rows[0].liquidez_status).toBe("Pagado al Comercial");
    expect(contract.rows[0].payment_date).toBeTruthy();
  });

  test("revierte el cambio de estado si falla la inserción de una nota", async () => {
    const response = await request({
      mode: "apply",
      status: "Pagado al Comercial",
      updates: [
        { id: "TR-1", notes: [{ message: "FALLA", isInternal: false }] },
      ],
    });

    expect(response.status).toBe(500);
    const contract = await client.execute(
      "SELECT liquidez_status, payment_date FROM tramites WHERE id = 'TR-1'",
    );
    expect(contract.rows[0].liquidez_status).toBe(
      "Cobrado por Comercializadora",
    );
    expect(contract.rows[0].payment_date).toBeNull();
  });

  test("no permite notas internas a un comercial", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { id: "USER-2", role: "2" },
    });
    const response = await request({
      mode: "apply",
      status: "Pagado al Comercial",
      updates: [
        { id: "TR-1", notes: [{ message: "Solo gestión", isInternal: true }] },
      ],
    });

    expect(response.status).toBe(403);
    expect(
      (
        await client.execute(
          "SELECT liquidez_status FROM tramites WHERE id = 'TR-1'",
        )
      ).rows[0].liquidez_status,
    ).toBe("Cobrado por Comercializadora");
  });
});
