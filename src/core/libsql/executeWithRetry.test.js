import { describe, expect, test, vi } from "vitest";
import {
  executeReadWithRetry,
  isRetryableLibsqlError,
} from "./executeWithRetry.ts";

const resultSet = {
  columns: [],
  columnTypes: [],
  rows: [{ value: 1 }],
  rowsAffected: 0,
  lastInsertRowid: undefined,
  toJSON() {
    return this;
  },
};

const retryableError = () => {
  const cause = new Error("other side closed");
  cause.code = "UND_ERR_SOCKET";
  return new TypeError("fetch failed", { cause });
};

describe("executeReadWithRetry", () => {
  test("retries transient libsql read errors and returns the eventual result", async () => {
    let calls = 0;
    const client = {
      execute: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw retryableError();
        return resultSet;
      }),
    };

    const result = await executeReadWithRetry(client, {
      sql: "SELECT 1",
      args: [],
    });

    expect(result).toBe(resultSet);
    expect(client.execute).toHaveBeenCalledTimes(2);
  });

  test("does not retry non-transient query errors", async () => {
    const sqlError = new Error("SQLITE_ERROR: no such table");
    const client = {
      execute: vi.fn(async () => {
        throw sqlError;
      }),
    };

    await expect(
      executeReadWithRetry(client, { sql: "SELECT * FROM missing", args: [] }),
    ).rejects.toBe(sqlError);
    expect(client.execute).toHaveBeenCalledTimes(1);
  });

  test("refuses writes before executing", async () => {
    const client = {
      execute: vi.fn(async () => resultSet),
    };

    await expect(
      executeReadWithRetry(client, { sql: "UPDATE users SET name = ?", args: [] }),
    ).rejects.toThrow("only accepts SELECT/WITH statements");
    expect(client.execute).not.toHaveBeenCalled();
  });

  test("propagates retryable errors after three attempts", async () => {
    const client = {
      execute: vi.fn(async () => {
        throw retryableError();
      }),
    };

    await expect(
      executeReadWithRetry(client, { sql: "WITH x AS (SELECT 1) SELECT * FROM x" }),
    ).rejects.toThrow("fetch failed");
    expect(client.execute).toHaveBeenCalledTimes(3);
  });
});

describe("isRetryableLibsqlError", () => {
  test("detects nested socket causes", () => {
    expect(isRetryableLibsqlError(retryableError())).toBe(true);
    expect(isRetryableLibsqlError(new Error("SQLITE_CONSTRAINT"))).toBe(false);
  });
});
