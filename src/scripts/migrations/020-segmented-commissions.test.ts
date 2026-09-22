// @vitest-environment node
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../migrations/020_segmented_commissions_and_abarca_sync.sql", import.meta.url),
  "utf8",
);
let db: ReturnType<typeof createClient>;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE user(id TEXT PRIMARY KEY, abarca_user_id INTEGER, role TEXT);
    CREATE TABLE comercializadoras(id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE user_company_commissions(
      id TEXT PRIMARY KEY, user_id TEXT, comercializadora_id TEXT,
      commission_type TEXT, commission_value REAL, created_at TEXT, updated_at TEXT,
      UNIQUE(user_id, comercializadora_id));
    CREATE TABLE default_company_commissions(
      id TEXT PRIMARY KEY, comercializadora_id TEXT,
      commission_type TEXT, commission_value REAL, created_at TEXT, updated_at TEXT,
      UNIQUE(comercializadora_id));
    CREATE TABLE comparativas(id TEXT PRIMARY KEY, service TEXT);
    INSERT INTO user VALUES ('u', 123, '2');
    INSERT INTO comercializadoras VALUES ('c', 'Company');
    INSERT INTO user_company_commissions VALUES ('u-rule','u','c','percent',0,NULL,NULL);
    INSERT INTO default_company_commissions VALUES ('d-rule','c','fixed',15,NULL,NULL);
    INSERT INTO comparativas VALUES ('gas', 'Gas'), ('light', 'Luz');
  `);
});

afterEach(() => db.close());

describe("020 segmented commissions migration", () => {
  it("replicates legacy rules into every segment and preserves zero", async () => {
    await db.executeMultiple(sql);
    const userRules = await db.execute("SELECT segment, commission_value FROM user_company_commissions ORDER BY segment");
    const defaults = await db.execute("SELECT segment, commission_value FROM default_company_commissions ORDER BY segment");
    expect(userRules.rows).toHaveLength(3);
    expect(userRules.rows.every((row) => Number(row.commission_value) === 0)).toBe(true);
    expect(defaults.rows).toHaveLength(3);
    await expect(db.execute(`INSERT INTO user_company_commissions
      (id,user_id,comercializadora_id,segment,commission_type,commission_value)
      VALUES ('duplicate','u','c','gas','fixed',1)`)).rejects.toThrow();
  });

  it("backfills only unequivocal gas comparisons", async () => {
    await db.executeMultiple(sql);
    const rows = await db.execute("SELECT id, commission_segment, commission_segment_origin FROM comparativas ORDER BY id");
    expect(rows.rows).toEqual([
      expect.objectContaining({ id: "gas", commission_segment: "gas", commission_segment_origin: "service" }),
      expect.objectContaining({ id: "light", commission_segment: null, commission_segment_origin: null }),
    ]);
  });
});
