import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAbarcaCommissionSnapshot, putAbarcaCommissions } from "./contract";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Abarca commission contract", () => {
  it("parses grouped per-user catalogs", () => {
    const snapshot = parseAbarcaCommissionSnapshot({
      ok: true,
      usuario: { comision_personalizada: null },
      comercializadoras: {
        gas: ["NATURGY"],
        luz_20td: [{ nombre: "ENDESA", bloqueada: false }],
      },
      reglas: [{ comercializadora: "ENDESA", segmento: "luz_20td", tipo: "porcentaje", valor: 12 }],
    });
    expect(snapshot.catalog).toEqual([
      { comercializadora: "NATURGY", segmento: "gas", bloqueada: false },
      { comercializadora: "ENDESA", segmento: "luz_20td", bloqueada: false },
    ]);
    expect(snapshot.rules).toHaveLength(1);
  });

  it("sends personalized null and never writes role commission", async () => {
    vi.stubEnv("ABARCA_COMISION_API_URL", "https://abarca.example/users");
    vi.stubEnv("ABARCA_COMISION_API_KEY", "secret");
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
      ok: true,
      usuario: { comision_personalizada: null },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await putAbarcaCommissions(123, [{
      comercializadora: "ENDESA",
      segmento: "luz_20td",
      tipo: "porcentaje",
      valor: 10,
    }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://abarca.example/users/123");
    expect(JSON.parse(String(init?.body))).toEqual({
      reglas: [{ comercializadora: "ENDESA", segmento: "luz_20td", tipo: "porcentaje", valor: 10 }],
      comision_personalizada: null,
    });
    expect(String(init?.body)).not.toContain("comision_rol");
  });

  it("does not treat a missing personalized field as confirmed null", () => {
    expect(parseAbarcaCommissionSnapshot({ ok: true }).personalized).toBeUndefined();
  });
});
