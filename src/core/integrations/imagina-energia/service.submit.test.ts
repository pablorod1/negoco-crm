// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getImaginaContractReadiness, submitImaginaContract } from "./service";
import { markTramiteSentToSupplier } from "./persistence";
import type { ImaginaEnergiaClient } from "./client";

let db: Client;
let directory: string;
const request = vi.fn();

const submit = (userId?: string) =>
  submitImaginaContract(
    { db, tenant: "test", client: { request } as unknown as ImaginaEnergiaClient },
    { tramiteId: "tramite-1", contractId: "contract-1", userId },
  );

beforeEach(async () => {
  vi.stubEnv("IMAGINA_AUTH_BASE_URL_PRE", "https://auth.test");
  vi.stubEnv("IMAGINA_API_BASE_URL_PRE", "https://api.test");
  vi.stubEnv("IMAGINA_EMAIL", "user@example.test");
  vi.stubEnv("IMAGINA_PASSWORD", "secret");
  vi.stubEnv("IMAGINA_CALLBACK_SEED_KEY", "seed");
  vi.stubEnv("IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN", "negoco.test");

  directory = await mkdtemp(join(tmpdir(), "imagina-submit-"));
  db = createClient({ url: `file:${join(directory, "db.sqlite")}` });
  await db.executeMultiple(`
    CREATE TABLE integrations (provider TEXT, enabled INTEGER, config TEXT);
    INSERT INTO integrations VALUES ('imagina_energia', 1, '{"x_canal_id":"canal"}');
    CREATE TABLE tramites (
      id TEXT PRIMARY KEY, client_id TEXT, user_id TEXT, status TEXT,
      tramitation_date TEXT, updated_at TEXT
    );
    INSERT INTO tramites VALUES ('tramite-1', 'client-1', 'user-1', 'Verificado', '', NULL);
    CREATE TABLE clients (
      id TEXT PRIMARY KEY, name TEXT, last_name TEXT, email TEXT, type TEXT,
      phone TEXT, phone_prefix TEXT, address TEXT, postal_code TEXT, province TEXT,
      city TEXT, document_type TEXT, document_number TEXT, IBAN TEXT,
      tipo_via_cnmc TEXT, calle TEXT, numero_finca TEXT, aclarador_finca TEXT, cnae TEXT
    );
    INSERT INTO clients VALUES (
      'client-1', 'Juan', 'Perez', 'juan@example.test', 'Particular',
      '600000000', '34', 'Alcala', '28001', 'Madrid',
      'Madrid', 'DNI', '12345678A', 'ES9121000418450200051332',
      'Calle', 'Alcala', '1', NULL, NULL
    );
    CREATE TABLE contracts (
      id TEXT PRIMARY KEY, tramite_id TEXT, type TEXT, province TEXT, city TEXT,
      address TEXT, postal_code TEXT, old_company TEXT, new_company TEXT,
      CUPS TEXT, pot1 REAL, pot2 REAL, pot3 REAL, pot4 REAL, pot5 REAL, pot6 REAL,
      rate_id TEXT, tipo_via_cnmc TEXT, calle TEXT, numero_finca TEXT,
      aclarador_finca TEXT, signature_channel TEXT, mismo_titular INTEGER,
      misma_potencia INTEGER, tipo_autoconsumo_cnmc TEXT
    );
    INSERT INTO contracts VALUES (
      'contract-1', 'tramite-1', 'Cambio Compañía', 'Madrid', 'Madrid',
      'Alcala', '28001', 'Otra', 'Imagina Energía',
      'ES0026000010979933FW', 4.6, 4.6, 0, 0, 0, 0,
      'rate-1', 'Calle', 'Alcala', '1',
      NULL, 'sms', 1, 1, NULL
    );
    CREATE TABLE signers (id TEXT PRIMARY KEY, client_id TEXT, name TEXT);
    CREATE TABLE comercializadora_rates (
      id TEXT PRIMARY KEY, provider TEXT, external_rate_id TEXT, enabled INTEGER
    );
    INSERT INTO comercializadora_rates VALUES ('rate-1', 'imagina_energia', '11001', 1);
    CREATE TABLE contract_integration_refs (
      id TEXT PRIMARY KEY, provider TEXT, tramite_id TEXT, contract_id TEXT,
      external_contract_id TEXT, external_contract_code TEXT, external_reference TEXT,
      request_id TEXT, status TEXT, substatus TEXT, synced_at TEXT,
      created_at TEXT, updated_at TEXT, UNIQUE(provider, contract_id)
    );
    CREATE TABLE imagina_contract_submissions (
      id TEXT PRIMARY KEY, tramite_id TEXT, contract_id TEXT,
      referencia_externa TEXT UNIQUE, request_id TEXT, endpoint TEXT, payload TEXT,
      response TEXT, status TEXT, validation_errors TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE tramite_changes (
      id TEXT PRIMARY KEY, tramite_id TEXT, user_id TEXT, change_type TEXT,
      field_name TEXT, old_value TEXT, new_value TEXT, description TEXT, created_at TEXT
    );
  `);
});

afterEach(async () => {
  db.close();
  await rm(directory, { recursive: true, force: true });
  request.mockReset();
  vi.unstubAllEnvs();
});

const tramiteStatus = async () =>
  String(
    (await db.execute("SELECT status FROM tramites WHERE id = 'tramite-1'"))
      .rows[0].status,
  );

test("moves the tramite to 'Enviado a comercializadora' once Imagina accepts", async () => {
  request.mockResolvedValueOnce({ data: { request_id: "req-1" } });

  const result = await submit("backoffice-1");

  expect(result.success).toBe(true);
  expect(result.data?.status).toBe("Enviado a comercializadora");
  expect(await tramiteStatus()).toBe("Enviado a comercializadora");

  const change = (
    await db.execute(
      "SELECT user_id, old_value, new_value, description FROM tramite_changes",
    )
  ).rows[0];
  expect(change).toMatchObject({
    user_id: "backoffice-1",
    old_value: "Verificado",
    new_value: "Enviado a comercializadora",
  });
  expect(String(change.description)).toContain("Imagina");

  const tramitationDate = (
    await db.execute("SELECT tramitation_date FROM tramites WHERE id = 'tramite-1'")
  ).rows[0].tramitation_date;
  expect(tramitationDate).toBeTruthy();
});

test("refuses to resend a contract Imagina has already created", async () => {
  await db.execute(
    `INSERT INTO contract_integration_refs (id, provider, tramite_id, contract_id, external_contract_id)
     VALUES ('ref-1', 'imagina_energia', 'tramite-1', 'contract-1', '987')`,
  );

  const result = await submit();

  expect(result).toMatchObject({ success: false, status: 409 });
  expect(result.error).toContain("987");
  expect(request).not.toHaveBeenCalled();
  expect(await tramiteStatus()).toBe("Verificado");
});

test("allows retrying when a previous attempt never produced a contract", async () => {
  await db.execute(
    `INSERT INTO contract_integration_refs (id, provider, tramite_id, contract_id, external_reference, request_id)
     VALUES ('ref-1', 'imagina_energia', 'tramite-1', 'contract-1', 'NEG-old', 'req-old')`,
  );
  request.mockResolvedValueOnce({ data: { request_id: "req-2" } });

  const result = await submit();

  expect(result.success).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
  const ref = (
    await db.execute(
      "SELECT request_id FROM contract_integration_refs WHERE contract_id = 'contract-1'",
    )
  ).rows[0];
  expect(ref.request_id).toBe("req-2");
});

test("does not persist anything nor change the status when Imagina rejects the request", async () => {
  request.mockRejectedValueOnce(new Error("HTTP 500"));

  await expect(submit()).rejects.toThrow("HTTP 500");

  expect(await tramiteStatus()).toBe("Verificado");
  expect(
    (await db.execute("SELECT COUNT(*) AS n FROM contract_integration_refs")).rows[0].n,
  ).toBe(0);
  expect(
    (await db.execute("SELECT COUNT(*) AS n FROM tramite_changes")).rows[0].n,
  ).toBe(0);
});

test("markTramiteSentToSupplier only advances from 'Verificado'", async () => {
  // El callback de Imagina llegó antes y ya movió el trámite.
  await db.execute(
    "UPDATE tramites SET status = 'Pendiente de Firma' WHERE id = 'tramite-1'",
  );

  const result = await markTramiteSentToSupplier(db, {
    tramiteId: "tramite-1",
    description: "test",
  });

  expect(result).toEqual({ updated: false, previousStatus: "Pendiente de Firma" });
  expect(await tramiteStatus()).toBe("Pendiente de Firma");
  expect(
    (await db.execute("SELECT COUNT(*) AS n FROM tramite_changes")).rows[0].n,
  ).toBe(0);
});

test("readiness lists required fields and what is still missing", async () => {
  await db.execute("UPDATE clients SET IBAN = '', email = 'no-es-un-email' WHERE id = 'client-1'");

  const result = await getImaginaContractReadiness(
    { db, tenant: "test" },
    { tramiteId: "tramite-1", contractId: "contract-1" },
  );

  expect(result.success).toBe(true);
  expect(result.data?.configured).toBe(true);
  expect(result.data?.required).toContain("nombre_titular");
  expect(result.data?.required).not.toContain("id_cnae");
  expect(result.data?.missing.map((item) => item.field).sort()).toEqual([
    "email_titular",
    "iban",
  ]);
});

test("readiness reports an unconfigured integration instead of failing", async () => {
  await db.execute("UPDATE integrations SET enabled = 0");

  const result = await getImaginaContractReadiness(
    { db, tenant: "test" },
    { tramiteId: "tramite-1", contractId: "contract-1" },
  );

  expect(result).toEqual({
    success: true,
    data: { configured: false, required: [], missing: [] },
  });
});
