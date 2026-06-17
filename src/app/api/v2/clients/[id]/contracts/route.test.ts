import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTursoClient: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));

describe("GET /api/v2/clients/[id]/contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  });

  test("returns files_count per contract and files_total", async () => {
    mocks.execute.mockResolvedValue({
      rows: [
        {
          id: "TR-1",
          status: "Activo",
          creation_date: "2026-06-16T10:00:00.000Z",
          sales_name: "Ana",
          files_count: 2,
        },
        {
          id: "TR-2",
          status: "Borrador",
          creation_date: "2026-06-15T10:00:00.000Z",
          sales_name: "Luis",
          files_count: 1,
        },
      ],
    });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ id: "CLI-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        contracts: [
          {
            id: "TR-1",
            status: "Activo",
            creation_date: "2026-06-16T10:00:00.000Z",
            sales_name: "Ana",
            files_count: 2,
          },
          {
            id: "TR-2",
            status: "Borrador",
            creation_date: "2026-06-15T10:00:00.000Z",
            sales_name: "Luis",
            files_count: 1,
          },
        ],
        total: 2,
        files_total: 3,
      },
    });
  });
});
