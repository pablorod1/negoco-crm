import { beforeEach, describe, expect, mock, test } from "bun:test";

let executeImpl;
let getSubcomercialesImpl;
let getTursoClientCalls = 0;

const execute = mock((statement) => executeImpl(statement));
const getTursoClient = mock(() => {
  getTursoClientCalls += 1;
  return { execute };
});

mock.module("@/core/libsql/client", () => ({
  getTursoClient,
}));

mock.module("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mock((...args) => getSubcomercialesImpl(...args)),
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
  const warn = mock(() => {});
  console.warn = warn;
  try {
    const result = await callback(warn);
    return result;
  } finally {
    console.warn = originalWarn;
  }
};

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
  getTursoClientCalls = 0;
  getSubcomercialesImpl = async () => ({ success: true, ids: [] });
  executeImpl = async () => resultSet();
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
    getSubcomercialesImpl = async () => {
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
    executeImpl = async (statement) => {
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
    expect(execute.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test("monthly analytics recovers when its query fails transiently once", async () => {
    let failed = false;
    executeImpl = async (statement) => {
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
    expect(execute.mock.calls.length).toBe(2);
  });
});
