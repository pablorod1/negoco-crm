import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));

vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: vi.fn().mockResolvedValue({ success: true, ids: [] }),
}));

type Row = Record<string, unknown>;

const buildRequest = (query = "") =>
  new NextRequest(`http://localhost/api/v2/contracts/export${query}`);

const asBackoffice = () =>
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: { id: "USER-1", role: "1", email: "bo@negoco.com", name: "Backoffice" },
  });

/**
 * Routes each SELECT to a canned result based on what it is selecting,
 * mirroring the three query shapes the endpoint issues.
 */
const stubQueries = ({
  total,
  tramites = [],
  notes = [],
}: {
  total: number;
  tramites?: Row[];
  notes?: Row[];
}) => {
  mocks.execute.mockImplementation(
    (statement: { sql: string; args?: unknown[] }) => {
      const { sql, args = [] } = statement;
      if (sql.includes("COUNT(*)")) return { rows: [{ total }] };
      if (sql.includes("FROM tickets")) {
        return { rows: notes.filter((n) => args.includes(n.ref_id)) };
      }
      // Hydration is the only query aggregating contracts; everything else that
      // selects t.id is the id-selection phase.
      if (sql.includes("GROUP_CONCAT")) {
        return { rows: tramites.filter((t) => args.includes(t.id)) };
      }
      return { rows: tramites.map((t) => ({ id: t.id })) };
    },
  );
};

/** All SQL statements issued, in order. */
const executedSql = (): string[] =>
  mocks.execute.mock.calls.map((call) => (call[0] as { sql: string }).sql);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
});

describe("GET /api/v2/contracts/export", () => {
  test("rejects unauthenticated requests", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
  });

  test("rejects comerciales: exports may carry internal notes", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { id: "USER-2", role: "2", email: "c@negoco.com", name: "Comercial" },
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("refuses to export beyond the row cap instead of truncating", async () => {
    asBackoffice();
    stubQueries({ total: 8312 });

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      success: false,
      error: "TOO_MANY_ROWS",
      total: 8312,
      limit: 5000,
    });
    // Only the count query ran: no hydration for a request we are refusing.
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  test("returns quick notes as dated, attributed lines per tramite", async () => {
    asBackoffice();
    stubQueries({
      total: 2,
      tramites: [
        { id: "TR-1", client_name: "Acme", client_last_name: "SL" },
        { id: "TR-2", client_name: "Beta", client_last_name: "" },
      ],
      notes: [
        {
          ref_id: "TR-1",
          message: "Cliente pide cambio de titular",
          created_at: "2026-03-12T09:00:00.000Z",
          author: "Ana",
        },
        {
          ref_id: "TR-1",
          message: "Pendiente\nde factura",
          created_at: "2026-03-14T09:00:00.000Z",
          author: "Luis",
        },
      ],
    });

    const response = await GET(buildRequest("?includeNotes=true"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);

    // Several notes stack as one line each; embedded newlines are flattened.
    expect(body.data[0].notes).toBe(
      "12/03/26 — Ana: Cliente pide cambio de titular\n14/03/26 — Luis: Pendiente de factura",
    );
    // A tramite without notes still exports, with an empty cell.
    expect(body.data[1].notes).toBe("");
    expect(body.data[0].client_name).toBe("Acme SL");
  });

  test("skips the tickets query entirely when notes are not requested", async () => {
    asBackoffice();
    stubQueries({ total: 1, tramites: [{ id: "TR-1" }] });

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].notes).toBeUndefined();
    expect(executedSql().some((sql) => sql.includes("FROM tickets"))).toBe(
      false,
    );
  });

  test("hydrates in chunks so GROUP_CONCAT never spans the whole export", async () => {
    asBackoffice();
    const tramites = Array.from({ length: 1200 }, (_, i) => ({ id: `TR-${i}` }));
    stubQueries({ total: tramites.length, tramites });

    const response = await GET(buildRequest("?includeNotes=true"));
    const body = await response.json();

    expect(response.status).toBe(200);

    // 1200 ids => 3 chunks of at most 500, for both hydration and notes.
    const hydrationCalls = executedSql().filter((sql) =>
      sql.includes("GROUP_CONCAT"),
    );
    const notesCalls = executedSql().filter((sql) =>
      sql.includes("FROM tickets"),
    );
    expect(hydrationCalls).toHaveLength(3);
    expect(notesCalls).toHaveLength(3);
    expect(body.data).toHaveLength(tramites.length);
  });

  test("applies the same filters as the paginated listing", async () => {
    asBackoffice();
    stubQueries({ total: 0 });

    await GET(
      buildRequest(
        `?statusFilter=${encodeURIComponent(JSON.stringify(["Activo"]))}`,
      ),
    );

    const [countStatement] = mocks.execute.mock.calls[0];
    expect(countStatement.sql).toContain("t.status IN (?)");
    expect(countStatement.args).toContain("Activo");
  });
});
