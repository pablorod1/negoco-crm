import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getSubcomerciales } from "./getSubcomerciales";

let client: Client;

beforeEach(async () => {
  client = createClient({ url: "file::memory:" });
  await client.execute(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      role TEXT,
      super_id TEXT
    )
  `);
  await client.batch(
    [
      ["commercial-root", "2", null],
      ["commercial-child", "2", "commercial-root"],
      ["backoffice-child", "1", "commercial-root"],
      ["admin-child", "admin", "commercial-root"],
      ["commercial-grandchild", "2", "commercial-child"],
      ["commercial-below-backoffice", "2", "backoffice-child"],
    ].map(([id, role, superId]) => ({
      sql: "INSERT INTO user (id, role, super_id) VALUES (?, ?, ?)",
      args: [id, role, superId],
    })),
  );
});

afterEach(() => {
  client.close();
});

describe("getSubcomerciales", () => {
  test("returns only commercial descendants through commercial branches", async () => {
    const result = await getSubcomerciales(client, "commercial-root");

    expect(result).toEqual({
      success: true,
      ids: expect.arrayContaining([
        "commercial-child",
        "commercial-grandchild",
      ]),
    });
    expect(result.ids).toHaveLength(2);
    expect(result.ids).not.toContain("backoffice-child");
    expect(result.ids).not.toContain("admin-child");
    expect(result.ids).not.toContain("commercial-below-backoffice");
  });

  test("terminates commercial cycles and returns unique descendants", async () => {
    await client.batch([
      {
        sql: "INSERT INTO user (id, role, super_id) VALUES (?, ?, ?)",
        args: ["cycle-a", "2", "cycle-b"],
      },
      {
        sql: "INSERT INTO user (id, role, super_id) VALUES (?, ?, ?)",
        args: ["cycle-b", "2", "cycle-a"],
      },
    ]);

    await expect(getSubcomerciales(client, "cycle-a")).resolves.toEqual({
      success: true,
      ids: ["cycle-b"],
    });
  });
});
