import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const LEGACY_COMPLETE = "comparisons.abarca.start";
const LEGACY_REVIEW = "comparisons.abarca.review";
const STUDY_COMPLETE = "comparisons.study.complete";
const STUDY_REVIEW = "comparisons.study.review";

let client: Client;
let databasePath: string;

beforeEach(async () => {
  databasePath = join(tmpdir(), `negoco-access-migration-${randomUUID()}.db`);
  client = createClient({ url: `file:${databasePath}` });
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("CREATE TABLE user (id TEXT PRIMARY KEY)");
});

afterEach(async () => {
  client.close();
  await Promise.all(
    [databasePath, `${databasePath}-shm`, `${databasePath}-wal`].map((path) =>
      rm(path, { force: true }),
    ),
  );
});

describe("014_add_access_control.sql", () => {
  test("creates constrained tables and cascades deleted users", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "migrations/014_add_access_control.sql"),
      "utf8",
    );

    await client.executeMultiple(migration);

    const tables = await client.execute(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('role_permission_settings', 'user_permission_overrides')
      ORDER BY name
    `);
    expect(tables.rows.map((row) => String(row.name))).toEqual([
      "role_permission_settings",
      "user_permission_overrides",
    ]);

    await expect(
      client.execute({
        sql: `INSERT INTO role_permission_settings
          (role, permission_key, enabled) VALUES (?, ?, ?)`,
        args: ["1", STUDY_COMPLETE, 2],
      }),
    ).rejects.toThrow();

    await client.execute({
      sql: `INSERT INTO role_permission_settings
        (role, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["1", STUDY_COMPLETE, 1],
    });
    await expect(
      client.execute({
        sql: `INSERT INTO role_permission_settings
          (role, permission_key, enabled) VALUES (?, ?, ?)`,
        args: ["1", STUDY_COMPLETE, 0],
      }),
    ).rejects.toThrow();

    await expect(
      client.execute({
        sql: `INSERT INTO user_permission_overrides
          (user_id, permission_key, enabled) VALUES (?, ?, ?)`,
        args: ["missing", STUDY_COMPLETE, 1],
      }),
    ).rejects.toThrow();

    await client.execute("INSERT INTO user (id) VALUES ('user-1')");
    await client.execute({
      sql: `INSERT INTO user_permission_overrides
        (user_id, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["user-1", STUDY_REVIEW, 0],
    });
    const storedOverride = await client.execute(`
      SELECT enabled, created_at, updated_at
      FROM user_permission_overrides
      WHERE user_id = 'user-1'
    `);
    expect(storedOverride.rows).toHaveLength(1);
    expect(Number(storedOverride.rows[0].enabled)).toBe(0);
    expect(storedOverride.rows[0].created_at).toBeTruthy();
    expect(storedOverride.rows[0].updated_at).toBeTruthy();

    await client.execute("DELETE FROM user WHERE id = 'user-1'");
    const afterDelete = await client.execute(
      "SELECT COUNT(*) AS count FROM user_permission_overrides",
    );
    expect(Number(afterDelete.rows[0].count)).toBe(0);
  });
});

describe("015_rename_study_permissions.sql", () => {
  const tables = [
    {
      name: "role",
      table: "role_permission_settings",
      subjectColumn: "role",
      subjectId: "1",
    },
    {
      name: "user",
      table: "user_permission_overrides",
      subjectColumn: "user_id",
      subjectId: "user-1",
    },
  ] as const;
  const mappings = [
    { name: "complete", legacyKey: LEGACY_COMPLETE, newKey: STUDY_COMPLETE },
    { name: "review", legacyKey: LEGACY_REVIEW, newKey: STUDY_REVIEW },
  ] as const;
  const scenarios = [
    { name: "copies source", destinationExists: false },
    { name: "preserves destination", destinationExists: true },
  ] as const;
  const cases = tables.flatMap((table) =>
    mappings.flatMap((mapping) =>
      scenarios.map((scenario) => ({ ...table, ...mapping, ...scenario })),
    ),
  );

  test.each(cases)(
    "$name $table $newKey",
    async ({
      table,
      subjectColumn,
      subjectId,
      legacyKey,
      newKey,
      destinationExists,
    }) => {
      const accessControlMigration = await readFile(
        resolve(process.cwd(), "migrations/014_add_access_control.sql"),
        "utf8",
      );
      const renameMigration = await readFile(
        resolve(process.cwd(), "migrations/015_rename_study_permissions.sql"),
        "utf8",
      );
      await client.executeMultiple(accessControlMigration);
      if (table === "user_permission_overrides") {
        await client.execute("INSERT INTO user (id) VALUES ('user-1')");
      }

      await client.execute({
        sql: `INSERT INTO ${table}
          (${subjectColumn}, permission_key, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)`,
        args: [subjectId, legacyKey, 0, "2025-01-01", "2025-01-02"],
      });
      if (destinationExists) {
        await client.execute({
          sql: `INSERT INTO ${table}
            (${subjectColumn}, permission_key, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
          args: [subjectId, newKey, 1, "2026-01-01", "2026-01-02"],
        });
      }

      await client.executeMultiple(renameMigration);

      const destination = await client.execute({
        sql: `SELECT permission_key, enabled, created_at, updated_at
          FROM ${table}
          WHERE ${subjectColumn} = ? AND permission_key = ?`,
        args: [subjectId, newKey],
      });
      expect(destination.rows).toEqual([
        {
          permission_key: newKey,
          enabled: destinationExists ? 1 : 0,
          created_at: destinationExists ? "2026-01-01" : "2025-01-01",
          updated_at: destinationExists ? "2026-01-02" : "2025-01-02",
        },
      ]);

      const legacy = await client.execute({
        sql: `SELECT permission_key
          FROM ${table}
          WHERE ${subjectColumn} = ? AND permission_key = ?`,
        args: [subjectId, legacyKey],
      });
      expect(legacy.rows).toEqual([]);
    },
  );
});
