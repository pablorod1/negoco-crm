import { createClient, type Client } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

let client: Client;

beforeEach(async () => {
  client = createClient({ url: "file::memory:" });
  await client.execute("CREATE TABLE user (id TEXT PRIMARY KEY)");
});

afterEach(() => {
  client.close();
});

describe("017_add_user_abarca_identity.sql", () => {
  test("allows null and distinct identities but rejects duplicate identities", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "migrations/017_add_user_abarca_identity.sql"),
      "utf8",
    );

    await client.executeMultiple(migration);
    await client.execute(`
      INSERT INTO user (id, abarca_user_id)
      VALUES ('without-identity-1', NULL),
             ('without-identity-2', NULL),
             ('with-identity-1', 101),
             ('with-identity-2', 202)
    `);

    const rows = await client.execute(`
      SELECT id, abarca_user_id
      FROM user
      ORDER BY id
    `);
    expect(rows.rows).toEqual([
      { id: "with-identity-1", abarca_user_id: 101 },
      { id: "with-identity-2", abarca_user_id: 202 },
      { id: "without-identity-1", abarca_user_id: null },
      { id: "without-identity-2", abarca_user_id: null },
    ]);

    await expect(
      client.execute(
        "INSERT INTO user (id, abarca_user_id) VALUES ('duplicate', 101)",
      ),
    ).rejects.toThrow();
  });
});
