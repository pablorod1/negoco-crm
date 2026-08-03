import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  buildContractBaseQuery,
  buildContractFilters,
  type ContractFilterInput,
} from "./contractFilters";

let client: Client;

const commercialUsers = [
  ["manager", "2", null],
  ["responsible-a", "2", "manager"],
  ["commercial-a1", "2", "responsible-a"],
  ["commercial-a2", "2", "responsible-a"],
  ["responsible-b", "2", "manager"],
  ["commercial-b1", "2", "responsible-b"],
  ["foreign-manager", "2", null],
  ["foreign-commercial", "2", "foreign-manager"],
] as const;

const nonCommercialUsers = [
  ["backoffice", "1", null],
  ["admin", "admin", null],
] as const;

const allUserIds = [...commercialUsers, ...nonCommercialUsers].map(
  ([id]) => id,
);

const contractIdsFor = (
  userIds: readonly string[],
  states: readonly ("active" | "draft")[] = ["active", "draft"],
) => userIds.flatMap((userId) => states.map((state) => `${userId}-${state}`));

async function queryVisibleContracts(input: ContractFilterInput) {
  const filterResult = await buildContractFilters(client, input);
  const baseQuery = buildContractBaseQuery(filterResult);

  const [contractsResult, countResult] = await Promise.all([
    client.execute({
      sql: `SELECT t.id ${baseQuery}`,
      args: filterResult.params,
    }),
    client.execute({
      sql: `SELECT COUNT(*) AS total ${baseQuery}`,
      args: filterResult.params,
    }),
  ]);

  return {
    ids: contractsResult.rows.map((row) => String(row.id)).sort(),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

beforeEach(async () => {
  client = createClient({ url: "file::memory:" });
  await client.batch([
    `CREATE TABLE user (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      super_id TEXT
    )`,
    `CREATE TABLE tramites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      creation_date TEXT NOT NULL
    )`,
  ]);

  await client.batch(
    [...commercialUsers, ...nonCommercialUsers].map(([id, role, superId]) => ({
      sql: "INSERT INTO user (id, role, super_id) VALUES (?, ?, ?)",
      args: [id, role, superId],
    })),
  );

  await client.batch(
    allUserIds.flatMap((userId) => [
      {
        sql: "INSERT INTO tramites (id, user_id, status, creation_date) VALUES (?, ?, ?, ?)",
        args: [
          `${userId}-draft`,
          userId,
          "Borrador",
          "2026-08-01T00:00:00.000Z",
        ],
      },
      {
        sql: "INSERT INTO tramites (id, user_id, status, creation_date) VALUES (?, ?, ?, ?)",
        args: [
          `${userId}-active`,
          userId,
          "Activo",
          "2026-08-02T00:00:00.000Z",
        ],
      },
    ]),
  );
});

afterEach(() => {
  client.close();
});

describe("commercial hierarchy visibility", () => {
  test.each([
    {
      label: "manager",
      userId: "manager",
      visibleUserIds: [
        "manager",
        "responsible-a",
        "commercial-a1",
        "commercial-a2",
        "responsible-b",
        "commercial-b1",
      ],
    },
    {
      label: "responsible",
      userId: "responsible-a",
      visibleUserIds: [
        "responsible-a",
        "commercial-a1",
        "commercial-a2",
      ],
    },
    {
      label: "leaf commercial",
      userId: "commercial-a1",
      visibleUserIds: ["commercial-a1"],
    },
  ])(
    "$label sees only own-branch contracts for drafts and non-drafts",
    async ({ userId, visibleUserIds }) => {
      const allVisible = await queryVisibleContracts({
        user_id: userId,
        user_role: "2",
      });
      const visibleDrafts = await queryVisibleContracts({
        user_id: userId,
        user_role: "2",
        statusFilter: ["Borrador"],
      });
      const visibleActive = await queryVisibleContracts({
        user_id: userId,
        user_role: "2",
        statusFilter: ["Activo"],
      });

      const expectedAllIds = contractIdsFor(visibleUserIds).sort();
      const expectedDraftIds = contractIdsFor(visibleUserIds, ["draft"]).sort();
      const expectedActiveIds = contractIdsFor(visibleUserIds, ["active"]).sort();

      expect(allVisible).toEqual({
        ids: expectedAllIds,
        total: expectedAllIds.length,
      });
      expect(visibleDrafts).toEqual({
        ids: expectedDraftIds,
        total: expectedDraftIds.length,
      });
      expect(visibleActive).toEqual({
        ids: expectedActiveIds,
        total: expectedActiveIds.length,
      });
    },
  );
});

describe("non-commercial visibility", () => {
  test.each([
    ["backoffice", "1"],
    ["admin", "admin"],
  ])(
    "%s sees only own drafts while retaining access to non-drafts",
    async (userId, userRole) => {
      const allVisible = await queryVisibleContracts({
        user_id: userId,
        user_role: userRole,
      });
      const visibleDrafts = await queryVisibleContracts({
        user_id: userId,
        user_role: userRole,
        statusFilter: ["Borrador"],
      });
      const expectedAllIds = [
        ...contractIdsFor(allUserIds, ["active"]),
        ...contractIdsFor([userId], ["draft"]),
      ].sort();

      expect(allVisible).toEqual({
        ids: expectedAllIds,
        total: expectedAllIds.length,
      });
      expect(visibleDrafts).toEqual({
        ids: contractIdsFor([userId], ["draft"]),
        total: 1,
      });
    },
  );
});
