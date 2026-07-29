import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: mocks.validateUserSession,
}));

const route = await import("./route");

let client: Client;
let databasePath: string;

const COMPLETE = "comparisons.study.complete";
const REVIEW = "comparisons.study.review";
const PUBLIC_COMPLETE = {
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
};
const PUBLIC_REVIEW = {
  key: REVIEW,
  group: "Comparativas",
  label: "Revisar estudios con IA",
  description:
    "Permite validar el resultado recibido y completar el estudio.",
  defaults: {
    admin: true,
    "1": true,
    "2": false,
  },
};

function request(method: "GET" | "PATCH", body?: unknown) {
  return new NextRequest("https://tenant.example.com/api/v2/access-control", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
  });
}

async function countRows(table: string) {
  const response = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(response.rows[0].count);
}

async function enableAiStudies() {
  await client.execute({
    sql: "UPDATE organization SET abarca_user_id = ?",
    args: [123],
  });
}

beforeEach(async () => {
  databasePath = join(tmpdir(), `negoco-access-control-${randomUUID()}.db`);
  client = createClient({ url: `file:${databasePath}` });
  await client.execute(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      role TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE role_permission_settings (
      role TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role, permission_key)
    )
  `);
  await client.execute(`
    CREATE TABLE user_permission_overrides (
      user_id TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, permission_key),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    )
  `);
  await client.execute(`
    CREATE TABLE organization (
      id TEXT PRIMARY KEY,
      abarca_user_id INTEGER
    )
  `);
  await client.execute({
    sql: "INSERT INTO user (id, role) VALUES (?, ?), (?, ?)",
    args: ["user-1", "2", "admin-2", "admin"],
  });
  await client.execute({
    sql: "INSERT INTO organization (id, abarca_user_id) VALUES (?, ?)",
    args: ["organization-1", null],
  });

  mocks.getTursoClient.mockReset();
  mocks.getTursoClient.mockReturnValue(client);
  mocks.validateUserSession.mockReset();
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: {
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
    },
  });
});

afterEach(async () => {
  client.close();
  await rm(databasePath, { force: true });
});

describe("GET /api/v2/access-control", () => {
  test("requires an authenticated session", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await route.GET(request("GET"));

    expect(response.status).toBe(401);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });

  test("rejects an authenticated non-admin", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "user-1",
        role: "1",
        email: "user@example.com",
        name: "User",
      },
    });

    const response = await route.GET(request("GET"));

    expect(response.status).toBe(403);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });

  test("filters capability permissions and preserves their stored rows", async () => {
    await client.execute({
      sql: `INSERT INTO role_permission_settings
        (role, permission_key, enabled) VALUES (?, ?, ?), (?, ?, ?)`,
      args: ["2", COMPLETE, 1, "2", REVIEW, 1],
    });
    await client.execute({
      sql: `INSERT INTO user_permission_overrides
        (user_id, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["user-1", REVIEW, 1],
    });

    const response = await route.GET(request("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.catalog).toEqual([PUBLIC_COMPLETE]);
    expect(JSON.stringify(body.data.catalog)).not.toContain(
      "requiredCapability",
    );
    expect(body.data.roles).toEqual([
      {
        id: "1",
        label: "Backoffice",
        permissions: { [COMPLETE]: true },
        settings: {},
      },
      {
        id: "2",
        label: "Comercial",
        permissions: { [COMPLETE]: true },
        settings: { [COMPLETE]: true },
      },
    ]);
    expect(body.data.user_overrides).toEqual([]);
    expect(await countRows("role_permission_settings")).toBe(2);
    expect(await countRows("user_permission_overrides")).toBe(1);

    await enableAiStudies();
    const integratedResponse = await route.GET(request("GET"));
    const integratedBody = await integratedResponse.json();

    expect(integratedResponse.status).toBe(200);
    expect(integratedBody.data.catalog).toEqual([
      PUBLIC_COMPLETE,
      PUBLIC_REVIEW,
    ]);
    expect(JSON.stringify(integratedBody.data.catalog)).not.toContain(
      "requiredCapability",
    );
    expect(integratedBody.data.roles[1]).toEqual({
      id: "2",
      label: "Comercial",
      permissions: { [COMPLETE]: true, [REVIEW]: true },
      settings: { [COMPLETE]: true, [REVIEW]: true },
    });
    expect(integratedBody.data.user_overrides).toEqual([
      {
        user_id: "user-1",
        permission_key: REVIEW,
        enabled: true,
      },
    ]);
  });

  test("shows capability permissions and stored values with a valid integration", async () => {
    await client.execute({
      sql: `INSERT INTO role_permission_settings
        (role, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["2", REVIEW, 1],
    });
    await client.execute({
      sql: `INSERT INTO user_permission_overrides
        (user_id, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["user-1", REVIEW, 1],
    });
    await enableAiStudies();

    const response = await route.GET(request("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.catalog).toEqual([PUBLIC_COMPLETE, PUBLIC_REVIEW]);
    expect(JSON.stringify(body.data.catalog)).not.toContain(
      "requiredCapability",
    );
    expect(body.data.roles[1]).toEqual({
      id: "2",
      label: "Comercial",
      permissions: { [COMPLETE]: false, [REVIEW]: true },
      settings: { [REVIEW]: true },
    });
    expect(body.data.user_overrides).toEqual([
      {
        user_id: "user-1",
        permission_key: REVIEW,
        enabled: true,
      },
    ]);
  });
});

describe("PATCH /api/v2/access-control", () => {
  test("requires authentication and admin authorization", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });
    const unauthorized = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "1",
            permission_key: COMPLETE,
            enabled: false,
          },
        ],
      }),
    );
    expect(unauthorized.status).toBe(401);

    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "user-1",
        role: "2",
        email: "user@example.com",
        name: "User",
      },
    });
    const forbidden = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "1",
            permission_key: COMPLETE,
            enabled: false,
          },
        ],
      }),
    );

    expect(forbidden.status).toBe(403);
    expect(await countRows("role_permission_settings")).toBe(0);
  });

  test("validates the complete strict payload before writing", async () => {
    const response = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "1",
            permission_key: COMPLETE,
            enabled: false,
          },
          {
            subject_type: "role",
            subject_id: "2",
            permission_key: "unknown.permission",
            enabled: true,
          },
        ],
        unexpected: true,
      }),
    );

    expect(response.status).toBe(400);
    expect(await countRows("role_permission_settings")).toBe(0);
  });

  test("rejects duplicate permission updates before opening the database", async () => {
    const response = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "1",
            permission_key: COMPLETE,
            enabled: false,
          },
          {
            subject_type: "role",
            subject_id: "1",
            permission_key: COMPLETE,
            enabled: true,
          },
        ],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "Duplicate permission update",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(await countRows("role_permission_settings")).toBe(0);
    expect(await countRows("user_permission_overrides")).toBe(0);
  });

  test("rejects malformed JSON", async () => {
    const malformedRequest = new NextRequest(
      "https://tenant.example.com/api/v2/access-control",
      {
        method: "PATCH",
        body: "{",
        headers: { "content-type": "application/json" },
      },
    );

    const response = await route.PATCH(malformedRequest);

    expect(response.status).toBe(400);
    expect(await countRows("role_permission_settings")).toBe(0);
  });

  test.each(["admin", "3"])(
    "rejects non-configurable role %s",
    async (role) => {
      const response = await route.PATCH(
        request("PATCH", {
          updates: [
            {
              subject_type: "role",
              subject_id: role,
              permission_key: COMPLETE,
              enabled: false,
            },
          ],
        }),
      );

      expect(response.status).toBe(400);
      expect(await countRows("role_permission_settings")).toBe(0);
    },
  );

  test("returns 404 for a missing user and rejects an admin user", async () => {
    const missing = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "user",
            subject_id: "missing",
            permission_key: COMPLETE,
            enabled: true,
          },
        ],
      }),
    );
    expect(missing.status).toBe(404);

    const admin = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "user",
            subject_id: "admin-2",
            permission_key: COMPLETE,
            enabled: false,
          },
        ],
      }),
    );
    expect(admin.status).toBe(400);
    expect(await countRows("user_permission_overrides")).toBe(0);
  });

  test("rejects unavailable permissions before writing any update", async () => {
    await client.execute({
      sql: `INSERT INTO role_permission_settings
        (role, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["2", REVIEW, 0],
    });

    const response = await route.PATCH(
      request("PATCH", {
        updates: [
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
        ],
      }),
    );
    const body = await response.json();
    const roleSettings = await client.execute({
      sql: `SELECT role, permission_key, enabled
        FROM role_permission_settings
        ORDER BY role, permission_key`,
      args: [],
    });

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "Permission is not available for this organization",
    });
    expect(roleSettings.rows).toEqual([
      {
        role: "2",
        permission_key: REVIEW,
        enabled: 0,
      },
    ]);
    expect(await countRows("user_permission_overrides")).toBe(0);
  });

  test("returns a filtered snapshot without deleting hidden stored rows", async () => {
    await client.execute({
      sql: `INSERT INTO role_permission_settings
        (role, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["2", REVIEW, 1],
    });
    await client.execute({
      sql: `INSERT INTO user_permission_overrides
        (user_id, permission_key, enabled) VALUES (?, ?, ?)`,
      args: ["user-1", REVIEW, 1],
    });

    const response = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "2",
            permission_key: COMPLETE,
            enabled: true,
          },
        ],
      }),
    );
    const body = await response.json();
    const roleSettings = await client.execute({
      sql: `SELECT role, permission_key, enabled
        FROM role_permission_settings
        ORDER BY role, permission_key`,
      args: [],
    });
    const userOverrides = await client.execute({
      sql: `SELECT user_id, permission_key, enabled
        FROM user_permission_overrides
        ORDER BY user_id, permission_key`,
      args: [],
    });

    expect(response.status).toBe(200);
    expect(body.data.catalog).toEqual([PUBLIC_COMPLETE]);
    expect(body.data.roles[1]).toEqual({
      id: "2",
      label: "Comercial",
      permissions: { [COMPLETE]: true },
      settings: { [COMPLETE]: true },
    });
    expect(body.data.user_overrides).toEqual([]);
    expect(roleSettings.rows).toEqual([
      {
        role: "2",
        permission_key: COMPLETE,
        enabled: 1,
      },
      {
        role: "2",
        permission_key: REVIEW,
        enabled: 1,
      },
    ]);
    expect(userOverrides.rows).toEqual([
      {
        user_id: "user-1",
        permission_key: REVIEW,
        enabled: 1,
      },
    ]);
  });

  test("inserts, updates and deletes a role setting and returns each snapshot", async () => {
    const upsert = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "2",
            permission_key: COMPLETE,
            enabled: true,
          },
        ],
      }),
    );
    const upsertBody = await upsert.json();

    expect(upsert.status).toBe(200);
    expect(upsertBody.data.roles[1]).toMatchObject({
      id: "2",
      permissions: { [COMPLETE]: true },
      settings: { [COMPLETE]: true },
    });

    const update = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "2",
            permission_key: COMPLETE,
            enabled: false,
          },
        ],
      }),
    );
    const updateBody = await update.json();
    const storedRoleSettings = await client.execute({
      sql: `SELECT enabled
        FROM role_permission_settings
        WHERE role = ? AND permission_key = ?`,
      args: ["2", COMPLETE],
    });

    expect(update.status).toBe(200);
    expect(updateBody.data.roles[1]).toMatchObject({
      id: "2",
      permissions: { [COMPLETE]: false },
      settings: { [COMPLETE]: false },
    });
    expect(storedRoleSettings.rows).toHaveLength(1);
    expect(Number(storedRoleSettings.rows[0].enabled)).toBe(0);

    const remove = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "2",
            permission_key: COMPLETE,
            enabled: null,
          },
        ],
      }),
    );
    const removeBody = await remove.json();

    expect(remove.status).toBe(200);
    expect(removeBody.data.roles[1]).toMatchObject({
      id: "2",
      permissions: { [COMPLETE]: false },
      settings: {},
    });
    expect(await countRows("role_permission_settings")).toBe(0);
  });

  test("inserts, updates and deletes a user override", async () => {
    const upsert = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "user",
            subject_id: "user-1",
            permission_key: COMPLETE,
            enabled: true,
          },
        ],
      }),
    );
    const upsertBody = await upsert.json();

    expect(upsert.status).toBe(200);
    expect(upsertBody.data.user_overrides).toEqual([
      {
        user_id: "user-1",
        permission_key: COMPLETE,
        enabled: true,
      },
    ]);

    const update = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "user",
            subject_id: "user-1",
            permission_key: COMPLETE,
            enabled: false,
          },
        ],
      }),
    );
    const updateBody = await update.json();
    const storedUserOverrides = await client.execute({
      sql: `SELECT enabled
        FROM user_permission_overrides
        WHERE user_id = ? AND permission_key = ?`,
      args: ["user-1", COMPLETE],
    });

    expect(update.status).toBe(200);
    expect(updateBody.data.user_overrides).toEqual([
      {
        user_id: "user-1",
        permission_key: COMPLETE,
        enabled: false,
      },
    ]);
    expect(storedUserOverrides.rows).toHaveLength(1);
    expect(Number(storedUserOverrides.rows[0].enabled)).toBe(0);

    const remove = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "user",
            subject_id: "user-1",
            permission_key: COMPLETE,
            enabled: null,
          },
        ],
      }),
    );
    const removeBody = await remove.json();

    expect(remove.status).toBe(200);
    expect(removeBody.data.user_overrides).toEqual([]);
    expect(await countRows("user_permission_overrides")).toBe(0);
  });

  test("rolls back every update when a later write fails", async () => {
    await enableAiStudies();
    await client.execute(`
      CREATE TRIGGER reject_review_role_setting
      BEFORE INSERT ON role_permission_settings
      WHEN NEW.permission_key = '${REVIEW}'
      BEGIN
        SELECT RAISE(ABORT, 'forced test failure');
      END
    `);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await route.PATCH(
      request("PATCH", {
        updates: [
          {
            subject_type: "role",
            subject_id: "1",
            permission_key: COMPLETE,
            enabled: false,
          },
          {
            subject_type: "role",
            subject_id: "1",
            permission_key: REVIEW,
            enabled: false,
          },
        ],
      }),
    );

    expect(response.status).toBe(500);
    expect(await countRows("role_permission_settings")).toBe(0);
  });
});
