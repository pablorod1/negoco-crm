// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";

let db: Client;
const columns = ["comision_fijo", "comision_indexado", "comision_sales_person_fijo", "comision_sales_person_indexado"];
const migration = () => readFileSync(new URL("../../../migrations/018_nullable_comparison_commissions.sql", import.meta.url), "utf8");
const rows = async (sql: string) => (await db.execute(sql)).rows;
const snapshot = async () => {
  const tables = await rows("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name");
  return Promise.all(tables.map(async ({ name }) => ({
    name,
    rows: await rows(`SELECT rowid, * FROM "${String(name).replaceAll('"', '""')}" ORDER BY rowid`),
  })));
};

beforeEach(async () => {
  db = createClient({ url: "file::memory:" });
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE suppliers (id TEXT PRIMARY KEY);
    INSERT INTO suppliers VALUES ('supplier');
    CREATE TABLE comparativas (
      id TEXT PRIMARY KEY, status TEXT NOT NULL,
      comision_fijo REAL NOT NULL, comision_indexado REAL NOT NULL,
      comision_sales_person_fijo REAL NOT NULL, comision_sales_person_indexado REAL NOT NULL,
      company_id TEXT REFERENCES suppliers(id),
      extra_payload TEXT NOT NULL UNIQUE CHECK(length(extra_payload) > 0)
    );
    CREATE INDEX comparison_status ON comparativas(status);
    CREATE INDEX comparison_pending ON comparativas(company_id) WHERE status = 'pending';
    CREATE INDEX comparison_commission ON comparativas(comision_fijo);
    CREATE TABLE comparativa_files (id TEXT PRIMARY KEY, comparativa_id TEXT REFERENCES comparativas(id) ON DELETE CASCADE);
    CREATE TABLE comparativa_changes (id TEXT PRIMARY KEY, comparativa_id TEXT REFERENCES comparativas(id) ON DELETE CASCADE);
    CREATE TABLE comparison_links (id TEXT PRIMARY KEY, comparativa_id TEXT REFERENCES comparativas(id) ON DELETE SET NULL);
    CREATE TABLE trigger_log (comparison_id TEXT);
    CREATE TRIGGER comparison_update AFTER UPDATE ON comparativas BEGIN INSERT INTO trigger_log VALUES (new.id); END;
    CREATE VIEW comparison_view AS SELECT id, comision_fijo FROM comparativas;
  `);
  for (const status of ["pending", "processing", "awaiting_review", "completed", "processed", "rejected", "rechazado_cliente"]) {
    await db.batch([
      { sql: "INSERT INTO comparativas VALUES (?, ?, 0, 0, 0, 0, 'supplier', ?)", args: [status, status, `payload-${status}`] },
      { sql: "INSERT INTO comparativa_files VALUES (?, ?)", args: [status, status] },
      { sql: "INSERT INTO comparativa_changes VALUES (?, ?)", args: [status, status] },
      { sql: "INSERT INTO comparison_links VALUES (?, ?)", args: [status, status] },
    ], "write");
  }
  await db.execute("INSERT INTO comparativas VALUES ('nonzero', 'processing', 10.5, -2, 30, 40, 'supplier', 'nonzero')");
});
afterEach(() => db.close());

describe("native libSQL nullable commission migration", () => {
  test("preserves every existing value in every status and all dependent rows and schema objects", async () => {
    const before = await snapshot();
    const objectsSql = "SELECT type, name, sql FROM sqlite_schema WHERE type IN ('trigger', 'index', 'view') ORDER BY name";
    const objects = await rows(objectsSql);
    await db.executeMultiple(migration());
    expect(await snapshot()).toEqual(before);
    expect(await rows(objectsSql)).toEqual(objects);
    expect(await rows("PRAGMA foreign_keys")).toEqual([{ foreign_keys: 1 }]);
    expect(await rows("PRAGMA foreign_key_check")).toEqual([]);
    expect(await rows("PRAGMA integrity_check")).toEqual([{ integrity_check: "ok" }]);
    expect(await rows("SELECT count(*) AS n FROM comparison_view")).toEqual([{ n: 8 }]);
    const commissions = (await rows("PRAGMA table_info(comparativas)")).filter((c) => columns.includes(String(c.name)));
    expect(commissions).toHaveLength(4);
    for (const column of commissions) expect(column).toMatchObject({ type: "REAL", notnull: 0, dflt_value: null });
    expect(await rows("SELECT * FROM trigger_log")).toEqual([]);
    await expect(db.execute("INSERT INTO comparativa_files VALUES ('invalid', 'missing')")).rejects.toThrow();
    await db.execute("UPDATE comparativas SET comision_fijo = 20 WHERE id = 'pending'");
    expect(await rows("SELECT * FROM trigger_log")).toEqual([{ comparison_id: "pending" }]);
  });

  test("accepts NULL on future comparisons and updates without converting historical zeros", async () => {
    await db.executeMultiple(migration());
    await db.execute("INSERT INTO comparativas VALUES ('new', 'pending', NULL, NULL, NULL, NULL, 'supplier', 'new')");
    expect(await rows(`SELECT ${columns.join(", ")} FROM comparativas WHERE id = 'new'`)).toEqual([
      Object.fromEntries(columns.map((name) => [name, null])),
    ]);
    expect(await rows(`SELECT ${columns.join(", ")} FROM comparativas WHERE id = 'pending'`)).toEqual([
      Object.fromEntries(columns.map((name) => [name, 0])),
    ]);
    await db.execute("UPDATE comparativas SET comision_sales_person_fijo = NULL WHERE id = 'awaiting_review'");
    expect(await rows("SELECT comision_sales_person_fijo FROM comparativas WHERE id = 'awaiting_review'")).toEqual([{ comision_sales_person_fijo: null }]);
  });

  test("is repeatable and leaves existing NULL, zero and nonzero amounts untouched", async () => {
    await db.executeMultiple(migration());
    await db.execute("UPDATE comparativas SET comision_fijo = NULL, comision_indexado = 125.5 WHERE id = 'pending'");
    const before = await snapshot();
    const schema = await rows("SELECT * FROM sqlite_schema ORDER BY name");
    await db.executeMultiple(migration());
    expect(await snapshot()).toEqual(before);
    expect(await rows("SELECT * FROM sqlite_schema ORDER BY name")).toEqual(schema);
  });

  test("preserves an existing result when migration 019 was applied first", async () => {
    await db.executeMultiple(readFileSync(new URL("../../../migrations/019_comparison_study_results.sql", import.meta.url), "utf8"));
    await db.execute(`INSERT INTO comparison_study_results
      (id, comparativa_id, payload_hash, crm_id, receipt_owner_id, revision_salt, state, offer_euros)
      VALUES ('demo', 'awaiting_review', 'hash', 123, 'owner', 'salt', 'pending', 200)`);
    const before = await snapshot();
    await db.executeMultiple(migration());
    expect(await snapshot()).toEqual(before);
    expect(await rows("PRAGMA foreign_key_check")).toEqual([]);
  });

  test("rolls back earlier column changes if a later statement fails", async () => {
    const schema = await rows("SELECT * FROM sqlite_schema ORDER BY name");
    const before = await snapshot();
    const broken = migration().replace("ALTER COLUMN comision_sales_person_fijo", "ALTER COLUMN missing_column");
    await expect(db.executeMultiple(broken)).rejects.toThrow();
    // The client's executeMultiple rolls back an unfinished transaction on error.
    expect(await rows("SELECT * FROM sqlite_schema ORDER BY name")).toEqual(schema);
    expect(await snapshot()).toEqual(before);
  });
});
