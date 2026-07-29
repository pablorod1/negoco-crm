import type { Client } from "@libsql/client";
import { describe, expect, test, vi } from "vitest";
import {
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  getDefaultPermissions,
} from "./catalog";
import { hasAiStudiesCapability } from "./capabilities";
import { hasPermission } from "./client";
import {
  AccessControlRequestError,
  resolveEffectivePermission,
  resolveEffectivePermissions,
  updateAccessControl,
} from "./server";

const COMPLETE = "comparisons.study.complete";
const REVIEW = "comparisons.study.review";

describe("access-control catalog", () => {
  test("defines all study permissions and their current role defaults", () => {
    expect(PERMISSION_KEYS).toEqual([COMPLETE, REVIEW]);
    expect(Object.isFrozen(PERMISSION_KEYS)).toBe(true);
    expect(() =>
      (PERMISSION_KEYS as unknown as string[]).push("unknown.permission"),
    ).toThrow(TypeError);
    expect(PERMISSION_CATALOG).toEqual([
      {
        key: COMPLETE,
        group: "Comparativas",
        label: "Completar estudios",
        description:
          "Permite completar o rechazar estudios pendientes, de forma manual o con IA cuando esté disponible.",
        defaults: {
          admin: true,
          "1": true,
          "2": false,
        },
      },
      {
        key: REVIEW,
        group: "Comparativas",
        label: "Revisar estudios con IA",
        description:
          "Permite validar el resultado recibido y completar el estudio.",
        requiredCapability: "ai_studies",
        defaults: {
          admin: true,
          "1": true,
          "2": false,
        },
      },
    ]);

    expect(getDefaultPermissions("admin")).toEqual({
      [COMPLETE]: true,
      [REVIEW]: true,
    });
    expect(getDefaultPermissions("1")).toEqual({
      [COMPLETE]: true,
      [REVIEW]: true,
    });
    expect(getDefaultPermissions("2")).toEqual({
      [COMPLETE]: false,
      [REVIEW]: false,
    });
  });
});

describe("tenant capabilities", () => {
  test.each([
    1,
    2,
    Number.MAX_SAFE_INTEGER,
    "1",
    "2",
    String(Number.MAX_SAFE_INTEGER),
  ])(
    "accepts positive safe integer %p",
    (value) => {
      expect(hasAiStudiesCapability(value)).toBe(true);
    },
  );

  test.each([
    null,
    undefined,
    "",
    "   ",
    " 2 ",
    "2 ",
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    0,
    -1,
    "0",
    "-1",
    "+1",
    "01",
    1.5,
    "1.5",
    "1e2",
    "0x10",
    "Infinity",
    Number.MAX_SAFE_INTEGER + 1,
    String(Number.MAX_SAFE_INTEGER + 1),
    true,
    {},
  ])("rejects non-capability value %p", (value) => {
    expect(hasAiStudiesCapability(value)).toBe(false);
  });
});

describe("effective permission resolver", () => {
  test("uses catalog defaults when no settings exist", () => {
    expect(resolveEffectivePermissions({ userRole: "1" })).toEqual({
      [COMPLETE]: true,
      [REVIEW]: true,
    });
    expect(resolveEffectivePermissions({ userRole: "2" })).toEqual({
      [COMPLETE]: false,
      [REVIEW]: false,
    });
  });

  test("keeps known permissions enabled for admin regardless of stored values", () => {
    expect(
      resolveEffectivePermissions({
        userRole: "admin",
        roleSettings: { [COMPLETE]: false, [REVIEW]: false },
        userOverrides: { [COMPLETE]: false, [REVIEW]: false },
      }),
    ).toEqual({
      [COMPLETE]: true,
      [REVIEW]: true,
    });
  });

  test("applies user override before role setting", () => {
    expect(
      resolveEffectivePermission(
        {
          userRole: "2",
          roleSettings: { [COMPLETE]: false },
          userOverrides: { [COMPLETE]: true },
        },
        COMPLETE,
      ),
    ).toBe(true);
  });

  test("enables and disables permissions independently", () => {
    expect(
      resolveEffectivePermissions({
        userRole: "1",
        userOverrides: { [COMPLETE]: false, [REVIEW]: true },
      }),
    ).toEqual({
      [COMPLETE]: false,
      [REVIEW]: true,
    });
  });

  test("denies an unknown key for every role", () => {
    expect(
      resolveEffectivePermission({ userRole: "admin" }, "unknown.permission"),
    ).toBe(false);
    expect(
      resolveEffectivePermission({ userRole: "1" }, "unknown.permission"),
    ).toBe(false);
  });
});

describe("client permission helper", () => {
  test("uses an explicit map value and falls back to role defaults", () => {
    expect(hasPermission({ [COMPLETE]: false }, "1", COMPLETE)).toBe(false);
    expect(hasPermission(undefined, "1", REVIEW)).toBe(true);
    expect(hasPermission(undefined, "2", REVIEW)).toBe(false);
  });

  test("preserves admin access and denies unknown keys", () => {
    expect(hasPermission({ [COMPLETE]: false }, "admin", COMPLETE)).toBe(true);
    expect(hasPermission(undefined, "admin", "unknown.permission")).toBe(false);
  });
});

describe("access-control updates", () => {
  test("validates, writes and reads the snapshot through one write transaction", async () => {
    const normalizeSql = (sql: string) => sql.replace(/\s+/g, " ").trim();
    const events: {
      label: string;
      sql: string | null;
      args: readonly unknown[];
    }[] = [];
    const userOverrides = new Map<
      string,
      { user_id: string; permission_key: string; enabled: number }
    >();
    const transaction = {
      execute: vi.fn(
        async ({
          sql,
          args,
        }: {
          sql: string;
          args: readonly unknown[];
        }) => {
          const normalizedSql = normalizeSql(sql);
          if (sql === "SELECT abarca_user_id FROM organization LIMIT 1") {
            events.push({
              label: "capability SELECT",
              sql: normalizedSql,
              args,
            });
            return {
              rows: [{ abarca_user_id: null }],
              rowsAffected: 0,
            };
          }
          if (sql.includes("WHERE id IN")) {
            events.push({
              label: "subject SELECT",
              sql: normalizedSql,
              args,
            });
            return {
              rows: [{ id: "user-1", role: "2" }],
              rowsAffected: 0,
            };
          }
          if (sql.includes("INSERT INTO user_permission_overrides")) {
            events.push({
              label: "UPSERT",
              sql: normalizedSql,
              args,
            });
            const [userId, permissionKey, enabled] = args;
            userOverrides.set(`${userId}:${permissionKey}`, {
              user_id: String(userId),
              permission_key: String(permissionKey),
              enabled: Number(enabled),
            });
            return { rows: [], rowsAffected: 1 };
          }
          if (sql.includes("FROM role_permission_settings")) {
            events.push({
              label: "role SELECT",
              sql: normalizedSql,
              args,
            });
            return { rows: [], rowsAffected: 0 };
          }
          if (sql.includes("FROM user_permission_overrides")) {
            events.push({
              label: "overrides SELECT",
              sql: normalizedSql,
              args,
            });
            return {
              rows: [...userOverrides.values()],
              rowsAffected: 0,
            };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
      ),
      commit: vi.fn(async () => {
        events.push({ label: "COMMIT", sql: null, args: [] });
      }),
      rollback: vi.fn(async () => {
        events.push({ label: "ROLLBACK", sql: null, args: [] });
      }),
    };
    const client = {
      execute: vi.fn(() => {
        throw new Error("query executed outside transaction");
      }),
      transaction: vi.fn(async (mode: string) => {
        events.push({
          label: `TRANSACTION ${mode}`,
          sql: null,
          args: [],
        });
        return transaction;
      }),
    } as unknown as Client;

    const snapshot = await updateAccessControl(client, [
      {
        subject_type: "user",
        subject_id: "user-1",
        permission_key: COMPLETE,
        enabled: true,
      },
    ]);

    expect(client.transaction).toHaveBeenCalledWith("write");
    expect(client.execute).not.toHaveBeenCalled();
    expect(events).toEqual([
      {
        label: "TRANSACTION write",
        sql: null,
        args: [],
      },
      {
        label: "capability SELECT",
        sql: "SELECT abarca_user_id FROM organization LIMIT 1",
        args: [],
      },
      {
        label: "subject SELECT",
        sql: "SELECT id, role FROM user WHERE id IN (?)",
        args: ["user-1"],
      },
      {
        label: "UPSERT",
        sql: "INSERT INTO user_permission_overrides ( user_id, permission_key, enabled, created_at, updated_at ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(user_id, permission_key) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP",
        args: ["user-1", COMPLETE, 1],
      },
      {
        label: "role SELECT",
        sql: "SELECT role, permission_key, enabled FROM role_permission_settings WHERE role IN (?, ?) ORDER BY role, permission_key",
        args: ["1", "2"],
      },
      {
        label: "overrides SELECT",
        sql: "SELECT user_id, permission_key, enabled FROM user_permission_overrides ORDER BY user_id, permission_key",
        args: [],
      },
      {
        label: "COMMIT",
        sql: null,
        args: [],
      },
    ]);
    expect(snapshot.user_overrides).toEqual([
      {
        user_id: "user-1",
        permission_key: COMPLETE,
        enabled: true,
      },
    ]);
  });

  test("rejects a capability permission before executing any write", async () => {
    const transaction = {
      execute: vi.fn(
        async ({ sql }: { sql: string; args: readonly unknown[] }) => {
          if (sql === "SELECT abarca_user_id FROM organization LIMIT 1") {
            return {
              rows: [{ abarca_user_id: null }],
              rowsAffected: 0,
            };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
      ),
      commit: vi.fn(),
      rollback: vi.fn(),
    };
    const client = {
      execute: vi.fn(),
      transaction: vi.fn(async () => transaction),
    } as unknown as Client;

    await expect(
      updateAccessControl(client, [
        {
          subject_type: "role",
          subject_id: "1",
          permission_key: COMPLETE,
          enabled: false,
        },
        {
          subject_type: "user",
          subject_id: "user-1",
          permission_key: REVIEW,
          enabled: true,
        },
      ]),
    ).rejects.toMatchObject({
      status: 400,
      message: "Permission is not available for this organization",
    });

    expect(transaction.execute).toHaveBeenCalledTimes(1);
    expect(transaction.execute).toHaveBeenCalledWith({
      sql: "SELECT abarca_user_id FROM organization LIMIT 1",
      args: [],
    });
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(client.execute).not.toHaveBeenCalled();
  });

  test("rolls back when subject validation fails inside the transaction", async () => {
    const transaction = {
      execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
      commit: vi.fn(),
      rollback: vi.fn(),
    };
    const client = {
      execute: vi.fn(),
      transaction: vi.fn(async () => transaction),
    } as unknown as Client;

    await expect(
      updateAccessControl(client, [
        {
          subject_type: "user",
          subject_id: "missing",
          permission_key: COMPLETE,
          enabled: true,
        },
      ]),
    ).rejects.toBeInstanceOf(AccessControlRequestError);

    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(client.execute).not.toHaveBeenCalled();
  });
});
