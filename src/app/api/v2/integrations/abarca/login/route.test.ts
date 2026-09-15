import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  fetch: vi.fn(),
  getEffectivePermission: vi.fn(),
  getSubcomerciales: vi.fn(),
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/access-control/server", () => ({
  getEffectivePermission: mocks.getEffectivePermission,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));

const route = await import("./route");

const authenticatedUser = {
  id: "user-1",
  role: "1",
  email: "user@example.com",
  name: "User",
};

function request(body: unknown) {
  return new NextRequest(
    "https://tenant.example.com/api/v2/integrations/abarca/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function allowPendingComparison(...values: [abarcaUserId?: unknown]) {
  const abarcaUserId = values.length === 0 ? 321 : values[0];

  mocks.execute
    .mockResolvedValueOnce({
      rows: [{ id: "comparison-1", status: "pending" }],
    })
    .mockResolvedValueOnce({
      rows:
        abarcaUserId === undefined
          ? []
          : [{ abarca_user_id: abarcaUserId }],
    });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ABARCA_API_KEY", "test-api-key");
  vi.stubEnv("ABARCA_TOKEN", "test-token");
  vi.stubGlobal("fetch", mocks.fetch);

  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: authenticatedUser,
  });
  mocks.getEffectivePermission.mockResolvedValue(true);
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  mocks.execute.mockImplementation(
    async (statement: { sql: string; args: unknown[] }) => {
      if (statement.sql.includes("FROM comparativas WHERE id = ?")) {
        return {
          rows: [{ id: "comparison-1", status: "pending" }],
        };
      }
      if (statement.sql.includes("FROM comparativa_files WHERE id = ?")) {
        return {
          rows: [
            {
              download_url:
                "https://storage.googleapis.com/tenant/invoice.pdf",
              extension: "pdf",
            },
          ],
        };
      }

      throw new Error(`Unexpected SQL in test: ${statement.sql}`);
    },
  );
});

describe("POST /api/v2/integrations/abarca/login", () => {
  test("returns 401 without a valid session", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns 403 before accessing the comparison or upstream when permission is denied", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role: "2" },
    });
    mocks.getEffectivePermission.mockResolvedValue(false);

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.getEffectivePermission).toHaveBeenCalledWith(
      expect.anything(),
      { ...authenticatedUser, role: "2" },
      "comparisons.study.complete",
    );
    expect(mocks.getSubcomerciales).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns 404 when the comparison is outside a commercial hierarchy", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role: "2" },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["user-2"],
    });
    mocks.execute.mockResolvedValueOnce({ rows: [] });

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(404);
    expect(mocks.getSubcomerciales).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["comparison-1", "user-1", "user-2"],
      }),
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns 409 when the accessible comparison is not pending", async () => {
    mocks.execute.mockResolvedValueOnce({
      rows: [{ id: "comparison-1", status: "awaiting_review" }],
    });

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(409);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test.each([
    null,
    undefined,
    0,
    -1,
    1.5,
    "",
    "0",
    "01",
    "1.5",
    "-1",
    "9007199254740992",
  ])(
    "returns 409 when the organization AI integration ID is invalid: %p",
    async (integrationId) => {
      allowPendingComparison(integrationId);

      const response = await route.POST(
        request({ comparativa_id: "comparison-1" }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "Integración de IA no configurada",
      });
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  test("uses the authenticated role-2 user's individual identity for a subordinate comparison", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role: "2" },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["subordinate-1"],
    });
    mocks.execute
      .mockResolvedValueOnce({
        rows: [{ id: "comparison-1", status: "pending" }],
      })
      .mockResolvedValueOnce({ rows: [{ abarca_user_id: "654" }] })
      .mockResolvedValueOnce({
        rows: [{ id: "comparison-1", status: "pending" }],
      });
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ login_url: "https://app.abarcaia.com/login" }),
        { status: 200 },
      ),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenNthCalledWith(1, {
      sql: expect.stringContaining("user_id IN"),
      args: ["comparison-1", "user-1", "subordinate-1"],
    });
    expect(mocks.execute).toHaveBeenNthCalledWith(2, {
      sql: expect.stringContaining("FROM user"),
      args: ["user-1"],
    });
    expect(
      mocks.execute.mock.calls.some(([statement]) =>
        String(statement.sql).includes("INNER JOIN organization"),
      ),
    ).toBe(false);
    const upstreamInit = mocks.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(upstreamInit.body))).toMatchObject({ idcm: 654 });
  });

  test("does not fall back to an available organization identity for role 2", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role: "2" },
    });
    mocks.execute.mockImplementation(
      async (statement: { sql: string; args: unknown[] }) => {
        if (statement.sql.includes("FROM comparativas WHERE id = ?")) {
          return {
            rows: [{ id: "comparison-1", status: "pending" }],
          };
        }
        if (statement.sql.includes("FROM user")) {
          return { rows: [] };
        }
        if (statement.sql.includes("INNER JOIN organization")) {
          return { rows: [{ abarca_user_id: 999 }] };
        }

        throw new Error(`Unexpected SQL in test: ${statement.sql}`);
      },
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Integración de IA no configurada",
    });
    expect(
      mocks.execute.mock.calls.some(([statement]) =>
        String(statement.sql).includes("INNER JOIN organization"),
      ),
    ).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test.each([null, undefined, 0, -1, 1.5, "0", "01", "9007199254740992"])(
    "returns 409 without organization fallback for an invalid role-2 identity: %p",
    async (individualId) => {
      mocks.validateUserSession.mockResolvedValue({
        success: true,
        user: { ...authenticatedUser, role: "2" },
      });
      mocks.execute
        .mockResolvedValueOnce({
          rows: [{ id: "comparison-1", status: "pending" }],
        })
        .mockResolvedValueOnce({
          rows:
            individualId === undefined
              ? []
              : [{ abarca_user_id: individualId }],
        });

      const response = await route.POST(
        request({ comparativa_id: "comparison-1" }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "Integración de IA no configurada",
      });
      expect(mocks.execute).toHaveBeenCalledTimes(2);
      expect(mocks.execute).toHaveBeenLastCalledWith({
        sql: expect.stringContaining("FROM user"),
        args: ["user-1"],
      });
      expect(
        mocks.execute.mock.calls.some(([statement]) =>
          String(statement.sql).includes("INNER JOIN organization"),
        ),
      ).toBe(false);
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  test.each(["admin", "1"])(
    "uses the organization identity for role %s",
    async (role) => {
      mocks.validateUserSession.mockResolvedValue({
        success: true,
        user: { ...authenticatedUser, role },
      });
      allowPendingComparison("765");
      mocks.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ login_url: "https://app.abarcaia.com/login" }),
          { status: 200 },
        ),
      );

      const response = await route.POST(
        request({ comparativa_id: "comparison-1" }),
      );

      expect(response.status).toBe(200);
      expect(mocks.execute).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sql: expect.stringContaining("INNER JOIN organization"),
          args: ["user-1"],
        }),
      );
      expect(
        mocks.execute.mock.calls.some(([statement]) =>
          String(statement.sql).includes("FROM user"),
        ),
      ).toBe(false);
      const upstreamInit = mocks.fetch.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(String(upstreamInit.body))).toMatchObject({ idcm: 765 });
    },
  );

  test("rejects legacy client-controlled Abarca fields", async () => {
    const response = await route.POST(
      request({
        comparativa_id: "comparison-1",
        ide: 999,
        idcm: 999,
        file_url: "https://attacker.example/file.pdf",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.getEffectivePermission).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test.each([
    { comparativa_id: "../comparison-1" },
    { comparativa_id: "comparison 1" },
    { comparativa_id: "a".repeat(129) },
    { comparativa_id: "comparison-1", file_id: "../file-1" },
    { comparativa_id: "comparison-1", file_id: "file.1" },
  ])("rejects unsafe comparison and file identifiers", async (body) => {
    const response = await route.POST(request(body));

    expect(response.status).toBe(400);
    expect(mocks.getEffectivePermission).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns a generic 500 when the database client is unavailable", async () => {
    mocks.getTursoClient.mockReturnValue(null);

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Internal server error",
    });
  });

  test("returns a generic 500 when integration environment is unavailable", async () => {
    vi.stubEnv("ABARCA_API_KEY", "");
    allowPendingComparison();

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Internal server error",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns 404 when file_id does not belong to the comparison", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({ rows: [] });

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-2" }),
    );

    expect(response.status).toBe(404);
    expect(mocks.execute).toHaveBeenLastCalledWith({
      sql: expect.stringContaining(
        "FROM comparativa_files WHERE id = ? AND comparativa_id = ?",
      ),
      args: ["file-2", "comparison-1"],
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("returns 400 when the selected comparison file is not a PDF", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url: "https://files.example/invoice.docx",
          extension: "docx",
        },
      ],
    });

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("derives ide and idcm server-side before requesting the login URL", async () => {
    allowPendingComparison("654");
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ login_url: "https://app.abarcaia.com/login" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ loginUrl: "https://app.abarcaia.com/login" });
    expect(mocks.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        args: ["user-1"],
        sql: expect.stringContaining("INNER JOIN organization"),
      }),
    );
    const upstreamInit = mocks.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(upstreamInit.body))).toEqual({
      ide: 100,
      idcm: 654,
      clave: "test-token",
      comparativa_id: "comparison-1",
    });
  });

  test("downloads only the selected server-resolved PDF and attaches it as base64", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url:
            "https://firebasestorage.googleapis.com/v0/b/tenant/o/invoice.pdf",
          extension: "PDF",
        },
      ],
    });
    mocks.fetch
      .mockResolvedValueOnce(
        new Response(new TextEncoder().encode("%PDF-1.7"), {
          status: 200,
          headers: { "content-type": "application/pdf; charset=binary" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ login_url: "https://app.abarcaia.com/login" }),
          { status: 200 },
        ),
      );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      "https://firebasestorage.googleapis.com/v0/b/tenant/o/invoice.pdf",
      expect.objectContaining({
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
    const upstreamInit = mocks.fetch.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(upstreamInit.body))).toMatchObject({
      comparativa_id: "comparison-1",
      pdf_base64: "JVBERi0xLjc=",
    });
  });

  test.each([
    {
      name: "selected PDF download failure",
      error: "No se pudo descargar el archivo",
      prepare: () => {
        allowPendingComparison();
        mocks.execute.mockResolvedValueOnce({
          rows: [
            {
              download_url:
                "https://storage.googleapis.com/tenant/invoice.pdf",
              extension: "pdf",
            },
          ],
        });
        mocks.fetch.mockResolvedValueOnce(
          new Response("not found", { status: 404 }),
        );
      },
      body: { comparativa_id: "comparison-1", file_id: "file-1" },
    },
    {
      name: "Abarca network failure",
      error: "No se pudo conectar con el comparador",
      prepare: () => {
        allowPendingComparison();
        mocks.fetch.mockRejectedValueOnce(new Error("network unavailable"));
      },
      body: { comparativa_id: "comparison-1" },
    },
    {
      name: "Abarca non-success response",
      error: "No se pudo conectar con el comparador",
      prepare: () => {
        allowPendingComparison();
        mocks.fetch.mockResolvedValueOnce(
          new Response("upstream failed", { status: 404 }),
        );
      },
      body: { comparativa_id: "comparison-1" },
    },
    {
      name: "Abarca invalid JSON response",
      error: "Respuesta inválida del comparador",
      prepare: () => {
        allowPendingComparison();
        mocks.fetch.mockResolvedValueOnce(
          new Response("<html>not json</html>", { status: 200 }),
        );
      },
      body: { comparativa_id: "comparison-1" },
    },
  ])("returns 502 for $name", async ({ prepare, body, error }) => {
    prepare();

    const response = await route.POST(request(body));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error });
  });

  test.each([
    "http://storage.googleapis.com/tenant/invoice.pdf",
    "https://evil.example/tenant/invoice.pdf",
    "https://storage.googleapis.com.evil.example/tenant/invoice.pdf",
    "https://storage.googleapis.com:444/tenant/invoice.pdf",
  ])("rejects an unsafe stored PDF URL: %s", async (downloadUrl) => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [{ download_url: downloadUrl, extension: "pdf" }],
    });

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(502);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("rejects PDF download redirects without following them", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url:
            "https://storage.googleapis.com/tenant/invoice.pdf",
          extension: "pdf",
        },
      ],
    });
    mocks.fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/invoice.pdf" },
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(502);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://storage.googleapis.com/tenant/invoice.pdf",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  test("rejects a PDF download with the wrong MIME type", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url:
            "https://storage.googleapis.com/tenant/invoice.pdf",
          extension: "pdf",
        },
      ],
    });
    mocks.fetch.mockResolvedValueOnce(
      new Response("%PDF", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(502);
  });

  test("rejects an oversized Content-Length before reading the body", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url:
            "https://storage.googleapis.com/tenant/invoice.pdf",
          extension: "pdf",
        },
      ],
    });
    mocks.fetch.mockResolvedValueOnce(
      new Response("%PDF", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": String(25 * 1024 * 1024 + 1),
        },
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(502);
  });

  // El 502 que veíamos en producción era este: la cabecera no se podía
  // interpretar y se trataba como fichero inválido. El tamaño de verdad lo
  // mide el bucle de lectura, así que la entrega tiene que salir adelante.
  test.each(["1024, 1024", "no-es-un-numero", "-1"])(
    "sigue adelante con un Content-Length ilegible: %s",
    async (contentLength) => {
      allowPendingComparison();
      mocks.execute.mockResolvedValueOnce({
        rows: [
          {
            download_url:
              "https://storage.googleapis.com/tenant/invoice.pdf",
            extension: "pdf",
          },
        ],
      });
      mocks.fetch
        .mockResolvedValueOnce(
          new Response(new TextEncoder().encode("%PDF-1.7"), {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-length": contentLength,
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ login_url: "https://app.abarcaia.com/login" }),
            { status: 200 },
          ),
        );

      const response = await route.POST(
        request({ comparativa_id: "comparison-1", file_id: "file-1" }),
      );

      expect(response.status).toBe(200);
      const upstreamInit = mocks.fetch.mock.calls[1][1] as RequestInit;
      expect(JSON.parse(String(upstreamInit.body))).toMatchObject({
        pdf_base64: "JVBERi0xLjc=",
      });
    },
  );

  test("dice el tamaño real cuando el PDF no cabe, en vez de culpar a Abarca", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url: "https://storage.googleapis.com/tenant/invoice.pdf",
          extension: "pdf",
        },
      ],
    });
    mocks.fetch.mockResolvedValueOnce(
      new Response("%PDF", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": String(30 * 1024 * 1024),
        },
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(502);
    const { error } = (await response.json()) as { error: string };
    expect(error).toContain("30.0 MB");
    expect(error).toContain("25.0 MB");
  });

  test("enforces the PDF size limit while streaming when Content-Length is absent", async () => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url:
            "https://storage.googleapis.com/tenant/invoice.pdf",
          extension: "pdf",
        },
      ],
    });
    const thirteenMiB = new Uint8Array(13 * 1024 * 1024);
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(thirteenMiB);
            controller.enqueue(thirteenMiB);
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/pdf" },
        },
      ),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(502);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  test("aborts a PDF download that exceeds the timeout", async () => {
    vi.useFakeTimers();
    try {
      allowPendingComparison();
      mocks.execute.mockResolvedValueOnce({
        rows: [
          {
            download_url:
              "https://storage.googleapis.com/tenant/invoice.pdf",
            extension: "pdf",
          },
        ],
      });
      mocks.fetch.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      );

      const responsePromise = route.POST(
        request({ comparativa_id: "comparison-1", file_id: "file-1" }),
      );
      await vi.advanceTimersByTimeAsync(10_000);
      const response = await responsePromise;

      expect(response.status).toBe(502);
    } finally {
      vi.useRealTimers();
    }
  });

  test.each([
    { name: "empty body", bytes: new Uint8Array() },
    {
      name: "missing PDF signature",
      bytes: new TextEncoder().encode("not-a-pdf"),
    },
    {
      name: "signature after the first 1024 bytes",
      bytes: new TextEncoder().encode(`${"x".repeat(1024)}%PDF-1.7`),
    },
  ])("rejects a PDF with $name", async ({ bytes }) => {
    allowPendingComparison();
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          download_url:
            "https://storage.googleapis.com/tenant/invoice.pdf",
          extension: "pdf",
        },
      ],
    });
    mocks.fetch.mockResolvedValueOnce(
      new Response(bytes, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(502);
    // El problema es el fichero, no el comparador: el mensaje tiene que
    // decirle al comercial qué puede hacer al respecto.
    expect(await response.json()).toEqual({
      error:
        "El archivo guardado no es un PDF válido. Vuelve a subirlo o elige otro.",
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  test("revalidates permission immediately before contacting the comparator", async () => {
    allowPendingComparison();
    mocks.getEffectivePermission
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.getEffectivePermission).toHaveBeenCalledTimes(2);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "comparison is no longer accessible",
      rows: [],
      expectedStatus: 404,
      expectedError: "Comparativa no encontrada",
    },
    {
      name: "comparison is no longer pending",
      rows: [{ id: "comparison-1", status: "completed" }],
      expectedStatus: 409,
      expectedError: "La comparativa ya no está pendiente",
    },
  ])(
    "blocks the upstream request when revalidation shows $name",
    async ({ rows, expectedStatus, expectedError }) => {
      allowPendingComparison();
      mocks.execute.mockResolvedValueOnce({ rows });

      const response = await route.POST(
        request({ comparativa_id: "comparison-1" }),
      );

      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toEqual({ error: expectedError });
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  test("revalidates file ownership after downloading and before upstream submission", async () => {
    allowPendingComparison();
    mocks.execute
      .mockResolvedValueOnce({
        rows: [
          {
            download_url:
              "https://storage.googleapis.com/tenant/invoice.pdf",
            extension: "pdf",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "comparison-1", status: "pending" }],
      })
      .mockResolvedValueOnce({ rows: [] });
    mocks.fetch.mockResolvedValueOnce(
      new Response(new TextEncoder().encode("%PDF-1.7"), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1", file_id: "file-1" }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Archivo no encontrado",
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  test("times out the comparator login request", async () => {
    vi.useFakeTimers();
    try {
      allowPendingComparison();
      mocks.fetch.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      );

      const responsePromise = route.POST(
        request({ comparativa_id: "comparison-1" }),
      );
      await vi.advanceTimersByTimeAsync(10_000);
      const response = await responsePromise;

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        error: "No se pudo conectar con el comparador",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("rejects a comparator response larger than 64 KiB", async () => {
    allowPendingComparison();
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          login_url: "https://abarcaia.com/login",
          padding: "x".repeat(64 * 1024),
        }),
        { status: 200 },
      ),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Respuesta inválida del comparador",
    });
  });

  test("does not follow redirects from the comparator login endpoint", async () => {
    allowPendingComparison();
    mocks.fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/login" },
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(502);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://abarcaia.com/comparar/api/generate-login-token",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  test.each([
    "http://abarcaia.com/login",
    "https://abarcaia.com.evil.example/login",
    "https://abarcaia.com:444/login",
    "https://user@abarcaia.com/login",
  ])("rejects an unsafe upstream login URL: %s", async (loginUrl) => {
    allowPendingComparison();
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ login_url: loginUrl }), { status: 200 }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Respuesta inválida del comparador",
    });
  });

  test("rejects an upstream response with an invalid schema", async () => {
    allowPendingComparison();
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ url: "https://abarcaia.com/login" }), {
        status: 200,
      }),
    );

    const response = await route.POST(
      request({ comparativa_id: "comparison-1" }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Respuesta inválida del comparador",
    });
  });
});
