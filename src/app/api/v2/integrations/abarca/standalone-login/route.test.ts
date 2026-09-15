import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  fetch: vi.fn(),
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));

const route = await import("./route");

const authenticatedUser = {
  id: "user-1",
  role: "2",
  email: "user@example.com",
  name: "User",
  activeOrganizationId: "organization-1",
};

function request(body?: unknown) {
  return new NextRequest(
    "https://tenant.example.com/api/v2/integrations/abarca/standalone-login",
    {
      method: "POST",
      headers:
        body === undefined
          ? { host: "tenant.example.com" }
          : {
              "content-type": "application/json",
              host: "tenant.example.com",
            },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

function organizationRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    organization_id: "organization-1",
    plan_name: "comparador",
    abarca_user_id: 321,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ABARCA_API_KEY", "test-api-key");
  vi.stubEnv("ABARCA_TOKEN", "test-token");
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.execute.mockReset();
  mocks.execute.mockResolvedValue({ rows: [organizationRow()] });
  mocks.getTursoClient.mockReset();
  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  mocks.validateUserSession.mockReset();
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: authenticatedUser,
  });
  mocks.fetch.mockReset();
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ login_url: "https://app.abarcaia.com/login" }),
      { status: 200 },
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/v2/integrations/abarca/standalone-login", () => {
  test("returns 401 before tenant or upstream access without a valid session", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });
    const req = request({ idcm: 999 });

    const response = await route.POST(req);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.validateUserSession).toHaveBeenCalledWith(req);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("derives the tenant database and organization from the authenticated user", async () => {
    const req = request();

    const response = await route.POST(req);

    expect(response.status).toBe(200);
    expect(mocks.getTursoClient).toHaveBeenCalledWith(req);
    expect(mocks.execute).toHaveBeenCalledWith({
      sql: expect.stringContaining("FROM member m"),
      args: [
        authenticatedUser.id,
        authenticatedUser.activeOrganizationId,
        authenticatedUser.activeOrganizationId,
      ],
    });
    expect(mocks.execute.mock.calls[0][0].sql).toContain(
      "m.organization_id = ?",
    );
  });

  test("rejects an ambiguous membership when the session has no active organization", async () => {
    mocks.validateUserSession.mockResolvedValueOnce({
      success: true,
      user: {
        ...authenticatedUser,
        activeOrganizationId: undefined,
      },
    });
    mocks.execute.mockResolvedValueOnce({
      rows: [
        organizationRow(),
        organizationRow({ organization_id: "organization-2" }),
      ],
    });

    const response = await route.POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "membership is missing",
      rows: [],
    },
    {
      name: "organization is missing",
      rows: [
        organizationRow({
          organization_id: null,
          plan_name: null,
          abarca_user_id: null,
        }),
      ],
    },
  ])("returns 403 when $name", async ({ rows }) => {
    mocks.execute.mockResolvedValueOnce({ rows });

    const response = await route.POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test.each([null, "", "starter", "pro", "elite"])(
    "returns 403 for non-comparator plan %j",
    async (planName) => {
      mocks.execute.mockResolvedValueOnce({
        rows: [organizationRow({ plan_name: planName })],
      });

      const response = await route.POST(request());

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Forbidden" });
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  test.each([
    undefined,
    null,
    0,
    -1,
    1.5,
    "",
    "0",
    "not-a-number",
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid server comparator ID %j", async (integrationId) => {
    mocks.execute.mockResolvedValueOnce({
      rows: [organizationRow({ abarca_user_id: integrationId })],
    });

    const response = await route.POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Integración de IA no configurada",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("ignores a spoofed client idcm and uses only the server organization ID", async () => {
    mocks.execute.mockResolvedValueOnce({
      rows: [organizationRow({ abarca_user_id: 654 })],
    });

    const response = await route.POST(request({ idcm: 999_999 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      loginUrl: "https://app.abarcaia.com/login",
    });
    const requestInit = mocks.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      ide: 100,
      idcm: 654,
      clave: "test-token",
    });
    expect(String(requestInit.body)).not.toContain("999999");
  });

  test("does not require study permissions for a comparator-plan commercial", async () => {
    const response = await route.POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      loginUrl: "https://app.abarcaia.com/login",
    });
  });

  test("returns a generic internal error when integration environment is unavailable", async () => {
    vi.stubEnv("ABARCA_API_KEY", "");

    const response = await route.POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Internal server error",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns a generic internal error when the tenant database is unavailable", async () => {
    mocks.getTursoClient.mockImplementationOnce(() => {
      throw new Error("tenant database unavailable");
    });

    const response = await route.POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Internal server error",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns a generic comparator error on a network failure", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("network unavailable"));

    const response = await route.POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "No se pudo conectar con el comparador",
    });
  });

  test("aborts the upstream request after ten seconds", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const responsePromise = route.POST(request());
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await responsePromise;

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "No se pudo conectar con el comparador",
    });
  });

  test("returns a generic comparator error when reading the body fails", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("body unavailable"));
      },
    });
    mocks.fetch.mockResolvedValueOnce(new Response(body, { status: 200 }));

    const response = await route.POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "No se pudo conectar con el comparador",
    });
  });

  test.each([302, 404])(
    "returns a generic error for upstream HTTP %s without exposing its response",
    async (status) => {
      mocks.fetch.mockResolvedValueOnce(
        new Response("provider-sensitive-detail", { status }),
      );

      const response = await route.POST(request());

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        error: "No se pudo conectar con el comparador",
      });
    },
  );

  test("rejects an upstream response larger than 64 KiB", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response("x".repeat(64 * 1024 + 1), { status: 200 }),
    );

    const response = await route.POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Respuesta inválida del comparador",
    });
  });

  test("returns a generic validation error for a malformed upstream response", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response("<html>provider error</html>", { status: 200 }),
    );

    const response = await route.POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Respuesta inválida del comparador",
    });
  });

  test.each([
    {
      name: "is missing",
      payload: {},
    },
    {
      name: "has the wrong type",
      payload: { login_url: 123 },
    },
    {
      name: "uses HTTP",
      payload: { login_url: "http://abarcaia.com/login" },
    },
    {
      name: "uses a lookalike host",
      payload: { login_url: "https://abarcaia.com.evil.example/login" },
    },
    {
      name: "contains credentials",
      payload: { login_url: "https://user@abarcaia.com/login" },
    },
    {
      name: "uses an unsafe port",
      payload: { login_url: "https://abarcaia.com:444/login" },
    },
  ])("rejects login_url when it $name", async ({ payload }) => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    const response = await route.POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Respuesta inválida del comparador",
    });
  });

  test("preserves the successful public response contract", async () => {
    const response = await route.POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      loginUrl: "https://app.abarcaia.com/login",
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://abarcaia.com/comparar/api/generate-login-token",
      expect.objectContaining({
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
