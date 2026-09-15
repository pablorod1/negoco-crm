import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTursoControlClient: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoControlClient: mocks.getTursoControlClient,
}));

const route = await import("./route");

const bytes = new Uint8Array([1, 2, 3, 4]);

const request = (headers: Record<string, string> = {}) =>
  new NextRequest("http://test.localhost:3000/api/company-logos/adt.webp", {
    headers,
  });

beforeEach(() => {
  mocks.getTursoControlClient.mockReturnValue({ execute: mocks.execute });
  mocks.execute.mockResolvedValue({
    rows: [{ content_type: "image/webp", bytes, etag: "abc123" }],
  });
});

describe("GET /api/company-logos/[file]", () => {
  test("devuelve el logo con su tipo y su etag", async () => {
    const response = await route.GET(request(), {
      params: Promise.resolve({ file: "adt.webp" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("etag")).toBe('"abc123"');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  test("responde 304 si el navegador ya lo tiene", async () => {
    const response = await route.GET(request({ "if-none-match": '"abc123"' }), {
      params: Promise.resolve({ file: "adt.webp" }),
    });

    expect(response.status).toBe(304);
  });

  test("rechaza nombres que intentan salirse de la carpeta", async () => {
    const response = await route.GET(request(), {
      params: Promise.resolve({ file: "../../secreto.webp" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("404 cuando el logo no está guardado", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });

    const response = await route.GET(request(), {
      params: Promise.resolve({ file: "adt.webp" }),
    });

    expect(response.status).toBe(404);
  });

  test("404 si la base de control no está disponible", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getTursoControlClient.mockImplementation(() => {
      throw new Error("Missing Turso control database configuration");
    });

    const response = await route.GET(request(), {
      params: Promise.resolve({ file: "adt.webp" }),
    });

    expect(response.status).toBe(404);
  });
});
