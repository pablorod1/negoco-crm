// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { migrateImaginaEnergia } from "./imagina-energia";
import { addContracts } from "@/tramites/utils/addTramiteHelpers";
import { createEmptyContractDB } from "@/tramites/utils/tramite.factories";

let db: Client;
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "imagina-migration-"));
  db = createClient({ url: `file:${join(directory, "test.db")}` });
  await db.executeMultiple(`
    CREATE TABLE tramites (id TEXT PRIMARY KEY);
    CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE signers (id TEXT PRIMARY KEY);
    CREATE TABLE tramite_files (id TEXT PRIMARY KEY);
    CREATE TABLE comercializadora_rates (id TEXT PRIMARY KEY, comercializadora_id TEXT);
    CREATE TABLE contracts (
      id TEXT PRIMARY KEY, type TEXT, province TEXT, city TEXT, address TEXT,
      postal_code TEXT, old_company TEXT, new_company TEXT, plan TEXT, consumption REAL,
      CUPS TEXT, pot1 REAL, pot2 REAL, pot3 REAL, pot4 REAL, pot5 REAL, pot6 REAL,
      description TEXT, tramite_id TEXT
    );
    INSERT INTO contracts (id, address) VALUES ('existing', 'Calle Mayor 1');
    INSERT INTO clients VALUES ('client', 'Nombre existente');
  `);
});
afterEach(async () => { db.close(); await rm(directory, { recursive: true, force: true }); });

test("dry run does not alter schema or data", async () => {
  const before = await db.execute("SELECT sql FROM sqlite_schema ORDER BY name");
  expect((await migrateImaginaEnergia(db)).length).toBeGreaterThan(0);
  expect((await db.execute("SELECT sql FROM sqlite_schema ORDER BY name")).rows).toEqual(before.rows);
});

test("migrates a legacy database, preserves records and supports the failing insert", async () => {
  await migrateImaginaEnergia(db, true);
  expect((await db.execute("SELECT address, signature_channel FROM contracts WHERE id = 'existing'")).rows).toEqual([{ address: "Calle Mayor 1", signature_channel: "sms" }]);
  expect((await db.execute("SELECT name, phone_prefix FROM clients")).rows).toEqual([{ name: "Nombre existente", phone_prefix: "34" }]);
  const contract = { ...createEmptyContractDB(), id: "new", tramite_id: "tramite", rate_id: "rate-1", calle: "Mayor", numero_finca: "1" };
  expect(await addContracts([contract], db)).toEqual({ success: true });
  expect((await db.execute("SELECT rate_id, calle, numero_finca FROM contracts WHERE id = 'new'")).rows).toEqual([{ rate_id: "rate-1", calle: "Mayor", numero_finca: "1" }]);
  expect(await migrateImaginaEnergia(db, true)).toEqual([]);
  expect((await db.execute("PRAGMA integrity_check")).rows).toEqual([{ integrity_check: "ok" }]);
});

test("resumes a partial migration without overwriting existing values", async () => {
  await db.executeMultiple("ALTER TABLE contracts ADD COLUMN rate_id TEXT; UPDATE contracts SET rate_id = 'historical';");
  await migrateImaginaEnergia(db, true);
  expect((await db.execute("SELECT rate_id FROM contracts")).rows).toEqual([{ rate_id: "historical" }]);
});

test("rolls back all changes when a required base table is missing", async () => {
  await db.execute("DROP TABLE signers");
  await expect(migrateImaginaEnergia(db, true)).rejects.toThrow("Falta la tabla base signers");
  expect((await db.execute("PRAGMA table_info(contracts)")).rows.some((row) => row.name === "rate_id")).toBe(false);
  expect((await db.execute("SELECT name FROM sqlite_schema WHERE name = 'integrations'")).rows).toEqual([]);
});
