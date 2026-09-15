import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  ELECTRICITY_CONSUMPTION_COLUMNS,
  ELECTRICITY_PS_COLUMNS,
  GAS_CONSUMPTION_COLUMNS,
  GAS_PS_COLUMNS,
  NUMERIC_APOLO_SIPS_COLUMNS,
} from "@/integrations/apolo-sips/columns.ts";

let validateUserSessionImpl;

const validateUserSession = mock((request) => validateUserSessionImpl(request));

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession,
}));

const route = await import("./route.ts");

const originalFetch = globalThis.fetch;

const request = (body) =>
  new Request("https://crm.test/api/v2/integrations/apolo-sips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const authenticatedUser = {
  id: "user-1",
  role: "2",
  email: "user@example.com",
  name: "User",
};

const csvFor = (columns, withRow = false) => {
  const rows = [columns.join(",")];

  if (withRow) {
    rows.push(
      columns
        .map((column) => {
          if (column === "cups") return "ES0222120028021251AW";
          if (column.startsWith("fecha")) return "2024-01-01";
          if (NUMERIC_APOLO_SIPS_COLUMNS.has(column)) return "1";
          return "X";
        })
        .join(","),
    );
  }

  return rows.join("\n");
};

const columnsForPayload = (payload) => {
  if (payload.TipoSuministro === "ELECTRICIDAD" && payload.Procedimiento === "PS") {
    return ELECTRICITY_PS_COLUMNS;
  }

  if (
    payload.TipoSuministro === "ELECTRICIDAD" &&
    payload.Procedimiento === "CONSUMOS"
  ) {
    return ELECTRICITY_CONSUMPTION_COLUMNS;
  }

  if (payload.TipoSuministro === "GAS" && payload.Procedimiento === "PS") {
    return GAS_PS_COLUMNS;
  }

  return GAS_CONSUMPTION_COLUMNS;
};

beforeEach(() => {
  validateUserSession.mockClear();
  validateUserSessionImpl = async () => ({ success: true, user: authenticatedUser });
  process.env.APOLO_SIPS_API_KEY = "test-secret-key";
  globalThis.fetch = mock(async (_url, init) => {
    const payload = JSON.parse(init.body);
    return new Response(csvFor(columnsForPayload(payload), false), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });
});

describe("POST /api/v2/integrations/apolo-sips", () => {
  test("rejects requests without an authenticated session", async () => {
    validateUserSessionImpl = async () => ({ success: false });

    const response = await route.POST(
      request({
        cups: "ES0222120028021251AW",
        tipoSuministro: "GAS",
        procedimientos: ["PS"],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ success: false, error: "No autorizado" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("rejects invalid payloads before contacting Apolo", async () => {
    const response = await route.POST(
      request({
        cups: "INVALID",
        tipoSuministro: "AGUA",
        procedimientos: ["PS", "PS"],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Payload inválido.");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("returns hasData false when Apolo returns only headers", async () => {
    const response = await route.POST(
      request({
        cups: "ES0222120028021251AW",
        tipoSuministro: "ELECTRICIDAD",
        procedimientos: ["CONSUMOS"],
      }),
    );
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.consumos.hasData).toBe(false);
    expect(body.data.consumos.rows).toEqual([]);
    expect(body.data.consumos.rowCount).toBe(0);
    expect(bodyText).not.toContain("test-secret-key");
  });

  test("starts PS and CONSUMOS upstream requests before awaiting either result", async () => {
    let resolveFirst;
    let firstResponsePending = true;

    globalThis.fetch = mock((_url, init) => {
      const payload = JSON.parse(init.body);

      if (payload.Procedimiento === "PS") {
        return new Promise((resolve) => {
          resolveFirst = () => {
            firstResponsePending = false;
            resolve(
              new Response(csvFor(GAS_PS_COLUMNS, true), {
                status: 200,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              }),
            );
          };
        });
      }

      expect(firstResponsePending).toBe(true);
      return Promise.resolve(
        new Response(csvFor(GAS_CONSUMPTION_COLUMNS, true), {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
      );
    });

    const responsePromise = route.POST(
      request({
        cups: "ES0222120028021251AW",
        tipoSuministro: "GAS",
        procedimientos: ["PS", "CONSUMOS"],
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    resolveFirst();
    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.ps.hasData).toBe(true);
    expect(body.data.consumos.hasData).toBe(true);
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
