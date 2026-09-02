import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ComparativaDB, ComparativaFile } from "@/comparativas/types";
import {
  ComparativaIdempotencyConflictError,
  createComparativaIdempotently,
} from "./createComparativa";

const comparativa: ComparativaDB = {
  id: "CMP-integration-1",
  client: "Acme",
  service: "Luz",
  plan: ["fijo"],
  comision: { fijo: 10, indexado: 0 },
  comision_sales_person: { fijo: 5, indexado: 0 },
  notes: [],
  user_id: "user-1",
  creation_date: "2026-07-31T08:00:00.000Z",
  status: "pending",
  tramite_id: undefined,
  has_permanencia: 0,
  has_renovacion: 0,
};

const file: ComparativaFile = {
  id: "file-integration-1",
  comparativa_id: comparativa.id,
  filename: "factura.pdf",
  size: 1024,
  extension: "pdf",
  upload_date: "2026-07-31T08:00:01.000Z",
  download_url: "https://storage.example.com/factura.pdf",
  preview_url: null,
};

let client: Client;
let databaseDirectory: string;

async function insertComparison(comparison: ComparativaDB): Promise<void> {
  await client.execute({
    sql: `INSERT INTO comparativas (
      id, client, service, plan, comision_fijo, comision_indexado,
      comision_sales_person_fijo, comision_sales_person_indexado,
      notes, user_id, creation_date, status, tramite_id, company_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      comparison.id,
      comparison.client,
      comparison.service,
      JSON.stringify(comparison.plan),
      comparison.comision.fijo,
      comparison.comision.indexado,
      comparison.comision_sales_person.fijo,
      comparison.comision_sales_person.indexado,
      JSON.stringify(comparison.notes),
      comparison.user_id,
      comparison.creation_date,
      comparison.status,
      comparison.tramite_id ?? null,
      null,
    ],
  });
}

beforeEach(async () => {
  databaseDirectory = mkdtempSync(join(tmpdir(), "negoco-comparison-test-"));
  client = createClient({
    url: `file:${join(databaseDirectory, "comparisons.db")}`,
  });
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE comparativas (
      id TEXT PRIMARY KEY,
      client TEXT NOT NULL,
      service TEXT NOT NULL,
      plan TEXT NOT NULL,
      comision_fijo REAL,
      comision_indexado REAL,
      comision_sales_person_fijo REAL,
      comision_sales_person_indexado REAL,
      notes TEXT NOT NULL,
      user_id TEXT NOT NULL,
      creation_date TEXT NOT NULL,
      status TEXT NOT NULL,
      tramite_id TEXT,
      company_id TEXT
    );
    CREATE TABLE comparativa_changes (
      id TEXT PRIMARY KEY,
      comparativa_id TEXT NOT NULL,
      user_id TEXT,
      change_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
    );
    CREATE TABLE comparativa_files (
      id TEXT PRIMARY KEY,
      comparativa_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      extension TEXT NOT NULL,
      upload_date TEXT NOT NULL,
      download_url TEXT NOT NULL,
      preview_url TEXT,
      FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
    );
  `);
});

afterEach(() => {
  client.close();
  rmSync(databaseDirectory, { recursive: true, force: true });
});

describe("createComparativaIdempotently", () => {
  test("persists unassigned null commissions and explicit zero without conflating them", async () => {
    await createComparativaIdempotently(client, {
      ...comparativa,
      comision: { fijo: null, indexado: 0 },
      comision_sales_person: { fijo: 0, indexado: null },
    }, []);
    const result = await client.execute("SELECT comision_fijo, comision_indexado, comision_sales_person_fijo, comision_sales_person_indexado FROM comparativas");
    expect({ ...result.rows[0] }).toEqual({
      comision_fijo: null, comision_indexado: 0,
      comision_sales_person_fijo: 0, comision_sales_person_indexado: null,
    });
  });

  test("creates once and treats the same operation as a successful retry", async () => {
    const first = await createComparativaIdempotently(client, comparativa, [
      file,
    ]);
    const retry = await createComparativaIdempotently(client, comparativa, [
      file,
    ]);

    expect(first).toEqual({ created: true });
    expect(retry).toEqual({ created: false });

    const counts = await client.batch([
      "SELECT COUNT(*) AS total FROM comparativas",
      "SELECT COUNT(*) AS total FROM comparativa_changes",
      "SELECT COUNT(*) AS total FROM comparativa_files",
    ]);
    expect(counts.map((result) => Number(result.rows[0].total))).toEqual([
      1, 1, 1,
    ]);
  });

  test("completes an older partial comparison atomically", async () => {
    await insertComparison(comparativa);

    const result = await createComparativaIdempotently(client, comparativa, [
      file,
    ]);

    expect(result).toEqual({ created: false });
    const auditCount = await client.execute(
      "SELECT COUNT(*) AS total FROM comparativa_changes",
    );
    const fileCount = await client.execute(
      "SELECT COUNT(*) AS total FROM comparativa_files",
    );
    expect(Number(auditCount.rows[0].total)).toBe(1);
    expect(Number(fileCount.rows[0].total)).toBe(1);
  });

  test("rolls back a new comparison when a file ID belongs to other data", async () => {
    const otherComparison = {
      ...comparativa,
      id: "CMP-other",
      creation_date: "2026-07-30T08:00:00.000Z",
    };
    await insertComparison(otherComparison);
    await client.execute({
      sql: `INSERT INTO comparativa_files (
        id, comparativa_id, filename, size, extension, upload_date,
        download_url, preview_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        file.id,
        otherComparison.id,
        "other.pdf",
        file.size,
        file.extension,
        file.upload_date,
        file.download_url,
        file.preview_url,
      ],
    });

    await expect(
      createComparativaIdempotently(client, comparativa, [file]),
    ).rejects.toBeInstanceOf(ComparativaIdempotencyConflictError);

    const newComparison = await client.execute({
      sql: "SELECT id FROM comparativas WHERE id = ?",
      args: [comparativa.id],
    });
    const newAudit = await client.execute({
      sql: "SELECT id FROM comparativa_changes WHERE comparativa_id = ?",
      args: [comparativa.id],
    });
    expect(newComparison.rows).toHaveLength(0);
    expect(newAudit.rows).toHaveLength(0);
  });
});
