import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getImaginaIntegrationStatus: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: () => ({ execute: mocks.execute }),
}));

vi.mock("@/core/integrations/imagina-energia", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/core/integrations/imagina-energia")>();

  return {
    ...original,
    getImaginaIntegrationStatus: mocks.getImaginaIntegrationStatus,
  };
});

const request = (query = "") =>
  new NextRequest(
    `http://localhost/api/v2/integrations/imagina-energia/tarifas/list${query}`,
  );

describe("GET /api/v2/integrations/imagina-energia/tarifas/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue({ rows: [] });
  });

  test("does not query rates when the tenant integration is not configured", async () => {
    mocks.getImaginaIntegrationStatus.mockResolvedValue({
      enabled: true,
      configured: false,
    });

    const response = await GET(request("?selected_rate_id=11001"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        integration: { enabled: true, configured: false },
        rates: [],
        unavailable_selected_rate: null,
      },
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("lists only available rates with a safe response shape", async () => {
    mocks.getImaginaIntegrationStatus.mockResolvedValue({
      enabled: true,
      configured: true,
    });
    mocks.execute.mockResolvedValue({
      rows: [
        {
          id: "rate-1",
          name: "Plan Noche",
          external_rate_id: "11001",
          alias_externo: "Noche",
          codigo_atr: "2.0TD",
          descripcion: "Tarifa nocturna",
          synced_at: "2026-07-14T10:00:00.000Z",
          raw: "secret payload",
          price: 0.19,
          channelId: "private-channel",
        },
      ],
    });

    const response = await GET(request("?selected_rate_id=11001"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        integration: { enabled: true, configured: true },
        rates: [
          {
            id: "rate-1",
            name: "Plan Noche",
            external_rate_id: "11001",
            alias_externo: "Noche",
            codigo_atr: "2.0TD",
            descripcion: "Tarifa nocturna",
            synced_at: "2026-07-14T10:00:00.000Z",
          },
        ],
        unavailable_selected_rate: null,
      },
    });

    const statement = mocks.execute.mock.calls[0][0] as {
      sql: string;
      args: unknown[];
    };
    expect(statement.sql).toContain("provider = ?");
    expect(statement.sql).toContain("enabled = 1");
    expect(statement.sql).toContain(
      "TRIM(CAST(external_rate_id AS TEXT)) <> ''",
    );
    expect(statement.sql).toContain("TRIM(CAST(synced_at AS TEXT)) <> ''");
    expect(statement.sql).toContain(
      "ORDER BY codigo_atr ASC, alias_externo ASC, name ASC",
    );
    expect(statement.args).toEqual(["imagina_energia"]);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  test("returns safe metadata for an unavailable historical selection", async () => {
    mocks.getImaginaIntegrationStatus.mockResolvedValue({
      enabled: true,
      configured: true,
    });
    mocks.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "legacy-rate",
            name: "Tarifa antigua",
            external_rate_id: "legacy-42",
            alias_externo: null,
            codigo_atr: "2.0TD",
            descripcion: "Ya no disponible",
            synced_at: null,
            enabled: 0,
            raw: "secret payload",
            config: "private config",
          },
        ],
      });

    const response = await GET(request("?selected_rate_id=legacy-42"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.unavailable_selected_rate).toEqual({
      id: "legacy-rate",
      name: "Tarifa antigua",
      external_rate_id: "legacy-42",
      alias_externo: null,
      codigo_atr: "2.0TD",
      descripcion: "Ya no disponible",
      synced_at: null,
    });
    expect(Object.keys(body.data.unavailable_selected_rate)).toEqual([
      "id",
      "name",
      "external_rate_id",
      "alias_externo",
      "codigo_atr",
      "descripcion",
      "synced_at",
    ]);

    const historicalStatement = mocks.execute.mock.calls[1][0] as {
      sql: string;
      args: unknown[];
    };
    expect(historicalStatement.sql).toContain("provider = ?");
    expect(historicalStatement.sql).toContain(
      "(id = ? OR external_rate_id = ?)",
    );
    expect(historicalStatement.args).toEqual([
      "imagina_energia",
      "legacy-42",
      "legacy-42",
    ]);
  });

  test("rejects an invalid selected_rate_id", async () => {
    const response = await GET(request("?selected_rate_id=%20%20"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "selected_rate_id no es válido",
    });
    expect(mocks.getImaginaIntegrationStatus).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "accepts 128 characters",
      query: `?selected_rate_id=${"a".repeat(128)}`,
      expectedStatus: 200,
      expectedStatusCalls: 1,
    },
    {
      name: "rejects more than 128 characters",
      query: `?selected_rate_id=${"a".repeat(129)}`,
      expectedStatus: 400,
      expectedStatusCalls: 0,
    },
    {
      name: "rejects duplicate parameters",
      query: "?selected_rate_id=rate-1&selected_rate_id=rate-2",
      expectedStatus: 400,
      expectedStatusCalls: 0,
    },
  ])("$name", async ({ query, expectedStatus, expectedStatusCalls }) => {
    mocks.getImaginaIntegrationStatus.mockResolvedValue({
      enabled: true,
      configured: false,
    });

    const response = await GET(request(query));

    expect(response.status).toBe(expectedStatus);
    expect(mocks.getImaginaIntegrationStatus).toHaveBeenCalledTimes(
      expectedStatusCalls,
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("keeps unavailable_selected_rate null when the selection does not exist", async () => {
    mocks.getImaginaIntegrationStatus.mockResolvedValue({
      enabled: true,
      configured: true,
    });
    mocks.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await GET(request("?selected_rate_id=missing-rate"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.unavailable_selected_rate).toBeNull();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  test("returns 500 when the rates query fails", async () => {
    mocks.getImaginaIntegrationStatus.mockResolvedValue({
      enabled: true,
      configured: true,
    });
    mocks.execute.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Error al listar tarifas sincronizadas de Imagina",
    });
  });
});
