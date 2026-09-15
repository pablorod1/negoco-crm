// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { syncImaginaTarifas } from "./service";
import type { ImaginaEnergiaClient } from "./client";

let db: Client;
let directory: string;
const request = vi.fn();
const first = {
  id_tarifa_precios: 1,
  nombre: "Plan Uno",
  energia_p1_formula: "0.12",
};
const second = { id_tarifa_precios: 2, nombre: "Plan Dos" };
const sync = (content: unknown[]) => {
  request.mockResolvedValueOnce({ data: { content, request_id: "request" } });
  return syncImaginaTarifas({
    db,
    tenant: "test",
    client: { request } as unknown as ImaginaEnergiaClient,
  });
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "imagina-rates-"));
  db = createClient({ url: `file:${join(directory, "db.sqlite")}` });
  await db.executeMultiple(`
    CREATE TABLE integrations (provider TEXT, enabled INTEGER, config TEXT);
    INSERT INTO integrations VALUES ('imagina_energia', 1, '{"x_canal_id":"test"}');
    CREATE TABLE comercializadoras (id TEXT, name TEXT, active INTEGER);
    INSERT INTO comercializadoras VALUES ('supplier', 'Imagina Energía', 1);
    CREATE TABLE comercializadora_rates (
      id TEXT PRIMARY KEY, name TEXT, price REAL, type TEXT, created_at TEXT, updated_at TEXT,
      comercializadora_id TEXT, provider TEXT, external_rate_id TEXT, alias_externo TEXT,
      codigo_atr TEXT, descripcion TEXT, raw TEXT, synced_at TEXT, enabled INTEGER,
      UNIQUE(comercializadora_id, provider, external_rate_id)
    );
  `);
});
afterEach(async () => {
  db.close();
  await rm(directory, { recursive: true, force: true });
  request.mockReset();
});

test("syncs additions and detects changes and withdrawals while preserving IDs", async () => {
  expect((await sync([first, second])).data).toMatchObject({
    count: 2,
    added: 2,
    updated: 0,
    deactivated: 0,
  });
  const original = (
    await db.execute(
      "SELECT id FROM comercializadora_rates WHERE external_rate_id = '1'",
    )
  ).rows[0].id;
  expect(
    (await sync([{ ...first, energia_p1_formula: "0.15" }])).data,
  ).toMatchObject({ count: 1, added: 0, updated: 1, deactivated: 1 });
  expect(
    (
      await db.execute(
        "SELECT id, price, enabled FROM comercializadora_rates WHERE external_rate_id = '1'",
      )
    ).rows[0],
  ).toEqual({ id: original, price: 0.15, enabled: 1 });
  expect(
    (
      await db.execute(
        "SELECT enabled FROM comercializadora_rates WHERE external_rate_id = '2'",
      )
    ).rows[0].enabled,
  ).toBe(0);
  expect(
    (
      await sync([
        {
          energia_p1_formula: "0.15",
          nombre: "Plan Uno",
          id_tarifa_precios: 1,
        },
      ])
    ).data,
  ).toMatchObject({ added: 0, updated: 0, deactivated: 0 });
});

test("does not modify other suppliers and reactivates returning tariffs", async () => {
  await sync([first]);
  await db.execute(
    "INSERT INTO comercializadora_rates (id, comercializadora_id, provider, enabled) VALUES ('other', 'other-supplier', 'imagina_energia', 1)",
  );
  expect((await sync([])).data).toMatchObject({ count: 0, deactivated: 1 });
  expect(
    (
      await db.execute(
        "SELECT enabled FROM comercializadora_rates WHERE id = 'other'",
      )
    ).rows[0].enabled,
  ).toBe(1);
  expect((await sync([first])).data).toMatchObject({
    added: 0,
    updated: 1,
    deactivated: 0,
  });
});

test("retains the catalogue when the upstream response is invalid or fails", async () => {
  await sync([first]);
  await expect(sync([{ nombre: "Missing identifier" }])).rejects.toThrow();
  await expect(sync([first, first])).rejects.toThrow("duplicados");
  request.mockRejectedValueOnce(new Error("timeout"));
  await expect(
    syncImaginaTarifas({
      db,
      tenant: "test",
      client: { request } as unknown as ImaginaEnergiaClient,
    }),
  ).rejects.toThrow("timeout");
  expect(
    (await db.execute("SELECT enabled FROM comercializadora_rates")).rows,
  ).toEqual([{ enabled: 1 }]);
});

test("rolls back withdrawals and updates if any insert fails", async () => {
  await sync([first]);
  await db.execute(
    "CREATE TRIGGER reject_second BEFORE INSERT ON comercializadora_rates WHEN NEW.external_rate_id = '2' BEGIN SELECT RAISE(ABORT, 'rejected'); END",
  );
  await expect(sync([second])).rejects.toThrow();
  expect(
    (
      await db.execute(
        "SELECT external_rate_id, enabled FROM comercializadora_rates",
      )
    ).rows,
  ).toEqual([{ external_rate_id: "1", enabled: 1 }]);
});
