import { beforeEach, describe, expect, test, vi } from "vitest";

let getTursoClientCalls = 0;

const mocks = vi.hoisted(() => ({
  executeImpl: undefined,
  getSubcomercialesImpl: undefined,
  execute: vi.fn((statement) => mocks.executeImpl(statement)),
  getTursoClient: vi.fn(),
  getSubcomerciales: vi.fn((...args) => mocks.getSubcomercialesImpl(...args)),
}));

const getTursoClient = vi.fn(() => {
  getTursoClientCalls += 1;
  return { execute: mocks.execute };
});

mocks.getTursoClient.mockImplementation(getTursoClient);

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoClient: mocks.getTursoClient,
}));

vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));
vi.mock("/src/core/libsql/users/getSubcomerciales.ts", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));

const contractsRoute = await import("./contracts/route.ts");
const comparisonsRoute = await import("./comparisons/route.ts");
const monthlyContractsRoute = await import(
  "./analytics/contracts/monthly/route.ts"
);

const resultSet = (rows = []) => ({
  columns: [],
  columnTypes: [],
  rows,
  rowsAffected: 0,
  lastInsertRowid: undefined,
  toJSON() {
    return this;
  },
});

const retryableError = () => {
  const cause = new Error("other side closed");
  cause.code = "UND_ERR_SOCKET";
  return new TypeError("fetch failed", { cause });
};

const contractsRequest = (query) => ({
  nextUrl: new URL(`https://beenergy.negococloud.es/api/v2/contracts?${query}`),
  headers: new Headers([["host", "beenergy.negococloud.es"]]),
});

const withMutedWarn = async (callback) => {
  const originalWarn = console.warn;
  const warn = vi.fn(() => {});
  console.warn = warn;
  try {
    const result = await callback(warn);
    return result;
  } finally {
    console.warn = originalWarn;
  }
};

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  getTursoClientCalls = 0;
  mocks.getSubcomercialesImpl = async () => ({ success: true, ids: [] });
  mocks.executeImpl = async () => resultSet();
});

describe("Vercel log error routes", () => {
  test("contracts rejects missing user context with 400 before DB access", async () => {
    const response = await contractsRoute.GET(
      contractsRequest("page=1&rowsPerPage=500"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: "Missing parameters" });
    expect(getTursoClientCalls).toBe(0);
  });

  test("comparisons rejects missing user context with 400 and no warning log", async () => {
    const response = await withMutedWarn(async (warn) => {
      const res = await comparisonsRoute.GET(
        new Request(
          "https://beenergy.negococloud.es/api/v2/comparisons?page=1&rowsPerPage=500",
        ),
      );
      expect(warn).not.toHaveBeenCalled();
      return res;
    });

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: "Missing parameters" });
    expect(getTursoClientCalls).toBe(0);
  });

  test("contracts returns 503 when subcomerciales lookup remains unavailable", async () => {
    mocks.getSubcomercialesImpl = async () => {
      throw retryableError();
    };

    const response = await withMutedWarn(() =>
      contractsRoute.GET(
        contractsRequest(
          "page=1&rowsPerPage=15&user_id=user-1&user_role=2",
        ),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(body).toEqual({
      success: false,
      error: "Base de datos temporalmente no disponible",
    });
  });

  test("contracts recovers when a count query fails transiently once", async () => {
    let countFailed = false;
    mocks.executeImpl = async (statement) => {
      if (statement.sql.includes("COUNT") && !countFailed) {
        countFailed = true;
        throw retryableError();
      }
      if (statement.sql.includes("COUNT")) return resultSet([{ total: 0 }]);
      if (statement.sql.includes("SELECT t.id")) return resultSet([]);
      throw new Error(`Unexpected SQL: ${statement.sql}`);
    };

    const response = await contractsRoute.GET(
      contractsRequest("page=1&rowsPerPage=15&user_id=user-1&user_role=2"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: [], total: 0 });
    expect(mocks.execute.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test("monthly analytics recovers when its query fails transiently once", async () => {
    let failed = false;
    mocks.executeImpl = async (statement) => {
      if (statement.sql.includes("FROM tramites") && !failed) {
        failed = true;
        throw retryableError();
      }
      return resultSet([]);
    };

    const response = await monthlyContractsRoute.POST(
      new Request(
        "https://beenergy.negococloud.es/api/v2/analytics/contracts/monthly",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "user-1",
            role: "2",
            time_range: "year",
          }),
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(12);
    expect(mocks.execute.mock.calls.length).toBe(2);
  });
});
