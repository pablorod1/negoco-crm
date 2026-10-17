// @vitest-environment node
import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { switchComparativaService } from "./comparativa";
import { StudyError } from "./errors";

let dir: string;
let client: Client;

beforeEach(async () => {
  // En un fichero: la transacción de libsql abre otra conexión y con
  // :memory: vería una base vacía.
  dir = mkdtempSync(path.join(tmpdir(), "comparativa-"));
  client = createClient({ url: `file:${path.join(dir, "tenant.db")}` });
  await client.executeMultiple(`
    CREATE TABLE comparativas (
      id TEXT PRIMARY KEY, service TEXT, status TEXT, commission_segment TEXT, commission_segment_origin TEXT);
    INSERT INTO comparativas VALUES ('cmp-luz', 'Luz', 'pending', 'luz_20td', 'tariff');
    INSERT INTO comparativas VALUES ('cmp-gas', 'Gas', 'processing', 'gas', 'service');
    INSERT INTO comparativas VALUES ('cmp-hecha', 'Luz', 'completed', NULL, NULL);
    CREATE TABLE comparativa_changes (
      id TEXT PRIMARY KEY, comparativa_id TEXT, user_id TEXT, change_type TEXT, field_name TEXT,
      old_value TEXT, new_value TEXT, description TEXT, created_at TEXT);
  `);
});

afterEach(() => {
  client.close();
  rmSync(dir, { recursive: true, force: true });
});

const row = async (id: string) =>
  (await client.execute({ sql: "SELECT service, commission_segment, commission_segment_origin FROM comparativas WHERE id = ?", args: [id] })).rows[0];
const changes = async (id: string) =>
  (await client.execute({ sql: "SELECT change_type, old_value, new_value, user_id FROM comparativa_changes WHERE comparativa_id = ?", args: [id] })).rows;

describe("pasar la comparativa de luz a gas, o al revés", () => {
  test("a gas: el segmento pasa a gas y queda en el historial", async () => {
    await switchComparativaService(client, { comparativaId: "cmp-luz", service: "Gas", userId: "user-1" });
    expect(await row("cmp-luz")).toMatchObject({ service: "Gas", commission_segment: "gas", commission_segment_origin: "service" });
    expect(await changes("cmp-luz")).toEqual([
      expect.objectContaining({ change_type: "service_update", old_value: "Luz", new_value: "Gas", user_id: "user-1" }),
    ]);
  });

  test("a luz: sin segmento hasta saber la tarifa", async () => {
    await switchComparativaService(client, { comparativaId: "cmp-gas", service: "Luz", userId: "user-1" });
    expect(await row("cmp-gas")).toMatchObject({ service: "Luz", commission_segment: null, commission_segment_origin: null });
  });

  test("si ya es de ese servicio no cambia nada", async () => {
    await switchComparativaService(client, { comparativaId: "cmp-gas", service: "Gas", userId: "user-1" });
    expect(await changes("cmp-gas")).toEqual([]);
  });

  test("una comparativa que ya no espera su estudio no se cambia", async () => {
    const error = await switchComparativaService(client, { comparativaId: "cmp-hecha", service: "Gas", userId: "user-1" }).catch(
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(StudyError);
    expect((error as StudyError).status).toBe(409);
    expect(await row("cmp-hecha")).toMatchObject({ service: "Luz" });
    expect(await changes("cmp-hecha")).toEqual([]);
  });
});
