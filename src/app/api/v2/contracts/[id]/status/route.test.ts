import { createClient, type Client } from "@libsql/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getTursoClient: vi.fn(),
  recordNoteChange: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/tramites/utils/tramiteChangesHelpers", () => ({
  recordStatusChange: vi.fn(),
  recordFieldChanges: vi.fn(),
  recordNoteChange: mocks.recordNoteChange,
}));

let client: Client;

beforeEach(async () => {
  vi.clearAllMocks();
  client = createClient({ url: "file::memory:" });
  mocks.getTursoClient.mockReturnValue(client);
  await client.batch([
    `CREATE TABLE tramites (
      id TEXT PRIMARY KEY, status TEXT, comision REAL, comision_sales_person REAL,
      notes TEXT, liquidez_status TEXT, collection_date TEXT, payment_date TEXT,
      activation_date TEXT, tramitation_date TEXT, renovation_date TEXT,
      processing_date TEXT, rejected_date TEXT, updated_by TEXT, updated_at TEXT
    )`,
    "INSERT INTO tramites (id, status, notes) VALUES ('TR-1', 'Borrador', '[\"Nota antigua\"]')",
    "CREATE TABLE ticket_types (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "INSERT INTO ticket_types (id, name) VALUES (3, 'note')",
    `CREATE TABLE tickets (
      id TEXT PRIMARY KEY, subject TEXT, message TEXT, is_internal INTEGER,
      status_id INTEGER, type_id INTEGER, context TEXT, ref_id TEXT,
      priority TEXT, created_by TEXT, assigned_to TEXT, created_at TEXT, updated_at TEXT
    )`,
  ]);
});

afterEach(() => client.close());

const update = (note?: string) =>
  PATCH(
    new NextRequest("http://localhost/api/v2/contracts/TR-1/status", {
      method: "PATCH",
      body: JSON.stringify({
        status: "Tramitable",
        user_id: "USER-1",
        note,
        notes: ["Nota antigua"],
      }),
    }),
    { params: Promise.resolve({ id: "TR-1" }) },
  );

describe("PATCH /api/v2/contracts/[id]/status", () => {
  test("stores the status note as a public quick-note ticket, not legacy JSON", async () => {
    const response = await update("  Seguimiento del cambio  ");

    expect(response.status).toBe(200);
    const contract = await client.execute(
      "SELECT status, notes FROM tramites WHERE id = 'TR-1'",
    );
    expect(contract.rows[0]).toMatchObject({
      status: "Tramitable",
      notes: '["Nota antigua"]',
    });

    const tickets = await client.execute(
      "SELECT subject, message, is_internal, type_id, context, ref_id, priority, created_by FROM tickets",
    );
    expect(tickets.rows).toHaveLength(1);
    expect(tickets.rows[0]).toMatchObject({
      subject: "Nota Rápida",
      message: "Seguimiento del cambio",
      is_internal: 0,
      type_id: 3,
      context: "tramite",
      ref_id: "TR-1",
      priority: "medium",
      created_by: "USER-1",
    });
    expect(mocks.recordNoteChange).toHaveBeenCalledWith(
      client,
      "TR-1",
      "USER-1",
      "Seguimiento del cambio",
    );
  });

  test("does not create a ticket for a blank note", async () => {
    const response = await update("   ");

    expect(response.status).toBe(200);
    const tickets = await client.execute("SELECT id FROM tickets");
    expect(tickets.rows).toHaveLength(0);
  });

  test("keeps the status unchanged if the note ticket cannot be inserted", async () => {
    await client.execute("DROP TABLE tickets");

    const response = await update("Debe quedar registrada");

    expect(response.status).toBe(500);
    const contract = await client.execute(
      "SELECT status, notes FROM tramites WHERE id = 'TR-1'",
    );
    expect(contract.rows[0]).toMatchObject({
      status: "Borrador",
      notes: '["Nota antigua"]',
    });
    expect(mocks.recordNoteChange).not.toHaveBeenCalled();
  });
});
