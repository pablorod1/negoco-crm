// @vitest-environment node
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RateExtractionResult } from "./extract";
import { toProposedCommissions, toProposedRates } from "./normalize";
import {
  claimIngest,
  createIngest,
  getActiveVersion,
  getIngest,
  getVersionPrices,
  listActiveOfferPrices,
  listCatalog,
  listCurrentCommissionRules,
  listTenantRates,
} from "./repository";
import type { ExtractedRate, RateDocumentExtraction } from "./schema";
import { memoryReadingCache } from "./reading-cache";
import { notifyPricesUpdated, tenantAppUrl } from "./notify-prices-updated";

const sendMail = vi.fn(async () => ({}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock("@/core/branding/email", () => ({
  resolveEmailBranding: async () => ({
    branding: { displayName: "Negoco" },
    logoUrl: "https://negococloud.es/logo.png",
    theme: { bodyBg: "#fff", headerBg: "#fff", heading: "#000", buttonBg: "#000", mutedBg: "#eee", subtleBg: "#eee", border: "#ddd", link: "#00f" },
  }),
  getEmailTransportConfig: () => ({}),
  getEmailFrom: () => ({ address: "noreply@negococloud.es", name: "Negoco" }),
}));
import { summarizeIngest } from "./views";
import { approveIngest, autoApproveIngest, buildReview, processIngest, RateIngestError } from "./service";
import { rowKey, validateProposedCommissions, validateProposedRates } from "./validate";

const MIGRATIONS = join(process.cwd(), "migrations");
const sql = (name: string) => readFileSync(join(MIGRATIONS, name), "utf8");

async function tenantDb(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE comercializadoras (id TEXT PRIMARY KEY, name TEXT, active INTEGER, logo TEXT);
    -- Como en Beenergy: sin las columnas de la integración de Imagina (provider, descripcion).
    CREATE TABLE comercializadora_rates (id TEXT PRIMARY KEY NOT NULL, name TEXT, price REAL,
      created_at TEXT, updated_at TEXT, comercializadora_id TEXT, type TEXT);
    INSERT INTO comercializadoras (id, name, active) VALUES ('COM-040', 'Quimera', 1), ('COM-041', 'Gana Energía', 1);
  `);
  await db.executeMultiple(sql("024_rate_versions.sql"));
  await db.executeMultiple(sql("024_rate_versions_columns.sql"));
  await db.execute("ALTER TABLE comercializadora_rates ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1");
  return db;
}

async function controlDb(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await db.executeMultiple(sql("023_rate_catalog.sql"));
  return db;
}

// Fragmento real del anexo de Quimera (octubre de 2026).
const QUIMERA_TEXT = `UNICORNIO (Renovaciones y nuevas contrataciones)
TARIFA 2.0TD P1 P2 P3
Energía (€/kWh) con SS.AA. 0,24755 0,17927 0,15329
Potencia pers. (€/kW día) 0,08960 0,07048
FÉNIX 2.0TD 0,23011 0,16120 0,13554`;

function rate(overrides: Partial<ExtractedRate>): ExtractedRate {
  return {
    productName: "Unicornio",
    accessTariff: "2.0TD",
    pricing: "fixed",
    level: null,
    territory: null,
    channel: null,
    segment: null,
    minKw: null,
    maxKw: null,
    minKwh: null,
    maxKwh: null,
    startFrom: null,
    startTo: null,
    months: null,
    powerMode: "fixed",
    powerUnit: "eur_kw_day",
    powerP1: 0.0896,
    powerP2: 0.07048,
    powerMargin: null,
    energyUnit: "eur_kwh",
    energyP1: 0.24755,
    energyP2: 0.17927,
    energyP3: 0.15329,
    singlePrice: false,
    ancillaryIncluded: true,
    gasTollsIncluded: null,
    feeMinMwh: null,
    feeMaxMwh: null,
    feeOnPower: false,
    discounts: [],
    ...overrides,
  };
}

function extractionResult(
  rates: ExtractedRate[],
  {
    partialUpdate = false,
    text = QUIMERA_TEXT as string | null,
    commissions = [] as RateDocumentExtraction["commissions"],
    validFrom = "2026-10-01" as string | null,
  } = {},
): RateExtractionResult {
  const extraction: RateDocumentExtraction = {
    supplierName: "Quimera Infinita",
    documentKind: commissions.length ? "prices_and_commissions" : "prices",
    validFrom,
    validTo: null,
    partialUpdate,
    rates,
    commissions,
    skipped: ["3.0TD y 6.1TD"],
  };
  const proposed = toProposedRates(extraction, text);
  const issues = validateProposedRates(proposed, {
    sourceText: text,
    partialUpdate,
    validFrom: extraction.validFrom,
  });
  return {
    status: issues.some(({ severity }) => severity === "blocking") ? "needs_review" : "ok",
    classification: null,
    extraction,
    proposed,
    issues,
    attempts: [],
    costUsd: 0.01,
  };
}


async function ingestWith(client: Client, result: RateExtractionResult, comercializadoraId: string | null) {
  const id = await createIngest(client, {
    channel: "upload",
    comercializadoraId,
    files: [],
    bodyText: QUIMERA_TEXT,
    createdBy: "user-1",
  });
  await processIngest({
    client,
    ingest: (await getIngest(client, id))!,
    tenantSlug: "test",
    userId: "user-1",
    extract: async ({ document }) => {
      expect(document.text).toContain("UNICORNIO");
      return result;
    },
  });
  return (await getIngest(client, id))!;
}

describe("documentAgeIssue", () => {
  test("warns when the annex is more than a month old", async () => {
    const { documentAgeIssue } = await import("./service");
    // El preciario de APOLO de la carpeta de Beenergy.
    expect(documentAgeIssue("2026-07-24", "2026-10-07")).toMatchObject({
      severity: "warning",
      code: "old_document",
      message: expect.stringContaining("hace 75 días"),
    });
    expect(documentAgeIssue("2026-09-30", "2026-10-07")).toBeNull();
    expect(documentAgeIssue(null, "2026-10-07")).toBeNull();
  });
});

describe("rate ingest service", () => {
  let client: Client;
  let control: Client;

  beforeEach(async () => {
    client = await tenantDb();
    control = await controlDb();
  });

  test("a reading cut off by the function's time limit can be claimed again after 15 minutes", async () => {
    await createIngest(client, { id: "ing-1", channel: "email", comercializadoraId: null, files: [], bodyText: "x", createdBy: null });
    expect(await claimIngest(client, "ing-1")).toBe(true);
    // Recién reclamada: nadie más la lee a la vez.
    expect(await claimIngest(client, "ing-1")).toBe(false);

    await client.execute("UPDATE rate_ingests SET processed_at = datetime('now', '-20 minutes') WHERE id = 'ing-1'");
    expect(await claimIngest(client, "ing-1")).toBe(true);
  });

  test("two approvals at the same time (the mailbox and a person) save one version", async () => {
    const ingest = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    const approve = (userId: string) =>
      approveIngest({ client, control, ingest, input: { validFrom: "2026-10-01" }, user: { id: userId }, today: "2026-10-07" });
    const results = await Promise.allSettled([approve("email:buzon"), approve("backoffice-1")]);
    expect(results.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });

    const { rows } = await client.execute("SELECT COUNT(*) AS n FROM comercializadora_rate_versions");
    expect(Number(rows[0].n)).toBe(1);
    expect((await listTenantRates(client, "COM-040")).filter(({ name }) => name === "Unicornio")).toHaveLength(1);
    expect((await getIngest(client, ingest.id))?.status).toBe("approved");
  });

  test("an approval that fails gives the ingest back for review", async () => {
    const ingest = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    const failing = { execute: control.execute.bind(control), batch: async () => Promise.reject(new Error("control caído")) };
    await expect(
      approveIngest({ client, control: failing, ingest, input: { validFrom: "2026-10-01" }, user: { id: "u1" }, today: "2026-10-07" }),
    ).rejects.toThrow("control caído");
    expect((await getIngest(client, ingest.id))?.status).toBe(ingest.status);
  });

  test("detects the supplier and adds new products to the catalog on approval", async () => {
    const ingest = await ingestWith(
      client,
      extractionResult([rate({}), rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554, powerMode: "regulated", powerUnit: null, powerP1: null, powerP2: null })]),
      null,
    );
    expect(ingest).toMatchObject({ status: "ready", comercializadoraId: "COM-040" });

    const built = await buildReview({ client, control, ingest, today: "2026-10-07" });
    expect(built?.review.newProducts).toEqual(["Unicornio", "Fénix"]);
    expect(built?.review.entries.map(({ kind }) => kind)).toEqual(["added", "added"]);

    const approved = await approveIngest({
      client,
      control,
      ingest,
      input: { validFrom: "2026-10-01" },
      user: { id: "backoffice-1" },
      today: "2026-10-07",
    });
    expect(approved.status).toBe("active");

    const { catalog } = await listCatalog(control, "quimera");
    expect(catalog.map(({ productKey }) => productKey).sort()).toEqual(["fenix", "unicornio"]);
    const tenantRates = await listTenantRates(client, "COM-040");
    expect(tenantRates.every(({ catalogRateId }) => catalogRateId)).toBe(true);

    const active = await getActiveVersion(client, "COM-040", "2026-10-07");
    const prices = await getVersionPrices(client, active!.id);
    expect(prices.find(({ rateName }) => rateName === "Fénix")).toMatchObject({
      powerMode: "regulated",
      power: null,
      energy: { P1: 0.23011, P2: 0.1612, P3: 0.13554 },
      sourceExcerpt: "FÉNIX 2.0TD 0,23011 0,16120 0,13554",
    });
    expect((await getIngest(client, ingest.id))?.status).toBe("approved");
  });

  test("annexes from the mailbox approve themselves, one per product, without retiring any", async () => {
    // Como Nordy: un correo con un PDF por producto, sin fecha, y cada uno
    // parece «la lista completa» a la IA.
    const unicornio = await ingestWith(client, extractionResult([rate({})], { validFrom: null }), null);
    const fenix = await ingestWith(
      client,
      extractionResult([rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554 })], { validFrom: null }),
      null,
    );
    const auto = (ingest: Awaited<ReturnType<typeof ingestWith>>) =>
      autoApproveIngest({ client, control, ingest, approvedBy: "user-7", receivedOn: "2026-10-13", today: "2026-10-13" });

    expect(await auto(unicornio)).toMatchObject({ approved: true });
    expect(await auto(fenix)).toMatchObject({ approved: true });

    // Entran los dos productos nuevos, en el catálogo y en la versión vigente,
    // con la fecha del correo.
    const { catalog } = await listCatalog(control, "quimera");
    expect(catalog.map(({ productKey }) => productKey).sort()).toEqual(["fenix", "unicornio"]);
    const active = await getActiveVersion(client, "COM-040", "2026-10-13");
    expect(active?.validFrom).toBe("2026-10-13");
    expect((await getVersionPrices(client, active!.id)).map(({ rateName }) => rateName).sort()).toEqual(["Fénix", "Unicornio"]);
    // La versión del primer anexo, sustituida el mismo día, termina ese día.
    const { rows } = await client.execute("SELECT valid_from, valid_to FROM comercializadora_rate_versions WHERE status = 'superseded'");
    expect(rows[0]).toMatchObject({ valid_from: "2026-10-13", valid_to: "2026-10-13" });

    // Un anexo anterior a los precios vigentes no los pisa.
    const old = await ingestWith(client, extractionResult([rate({})], { validFrom: "2026-09-01" }), null);
    const rejected = await auto(old);
    expect(rejected).toMatchObject({ approved: false });
    expect(await getIngest(client, old.id)).toMatchObject({ status: "rejected" });

    // Una lectura con cifras que no están en el documento espera.
    const doubtful = await ingestWith(client, extractionResult([rate({ energyP1: 0.31 })], { validFrom: null }), null);
    expect(await auto(doubtful)).toMatchObject({ approved: false });
    expect((await getIngest(client, doubtful.id))?.status).not.toBe("approved");
  });

  test("a partial update keeps untouched rates and can be scheduled", async () => {
    // Primera versión: Unicornio y Fénix ya en el catálogo y en el tenant.
    const first = await ingestWith(
      client,
      extractionResult([rate({}), rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554 })]),
      "COM-040",
    );
    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });

    // Un aviso que solo cambia la energía de Unicornio.
    const text = "Nuevo precio Unicornio: 0,25755 0,18927 0,16329";
    const partial = await ingestWith(
      client,
      extractionResult(
        [rate({ energyP1: 0.25755, energyP2: 0.18927, energyP3: 0.16329, powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null })],
        { partialUpdate: true, text },
      ),
      "COM-040",
    );
    const built = await buildReview({ client, control, ingest: partial, today: "2026-10-07" });
    expect(built?.review.entries.map(({ kind }) => kind)).toEqual(["changed", "carried"]);
    expect(built?.review.newProducts).toEqual([]);

    // Un backoffice (sin ser de Negoco) también la aprueba.
    const scheduled = await approveIngest({
      client, control, ingest: partial, input: { validFrom: "2026-10-15" },
      user: { id: "backoffice-1" }, today: "2026-10-07",
    });
    expect(scheduled.status).toBe("scheduled");
    expect((await getActiveVersion(client, "COM-040", "2026-10-07"))?.validFrom).toBe("2026-10-01");

    // Al llegar la fecha entra en vigor sola y cierra la anterior.
    const active = await getActiveVersion(client, "COM-040", "2026-10-15");
    expect(active?.id).toBe(scheduled.versionId);
    const prices = await getVersionPrices(client, active!.id);
    expect(prices).toHaveLength(2);
    expect(prices.find(({ rateName }) => rateName === "Unicornio")).toMatchObject({
      energy: { P1: 0.25755, P2: 0.18927, P3: 0.16329 },
      power: { P1: 0.0896, P2: 0.07048 },
    });
    const { rows } = await client.execute(
      "SELECT status, valid_to FROM comercializadora_rate_versions WHERE valid_from = '2026-10-01'",
    );
    expect(rows[0]).toMatchObject({ status: "superseded", valid_to: "2026-10-14" });
  });

  test("blocking issues must be excluded before approving", async () => {
    // Una cifra que no está en el documento.
    const ingest = await ingestWith(client, extractionResult([rate({ energyP1: 0.24775 })]), "COM-040");
    expect(ingest.status).toBe("needs_review");

    const attempt = approveIngest({
      client, control, ingest, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    await expect(attempt).rejects.toBeInstanceOf(RateIngestError);
    await expect(attempt).rejects.toThrow(/no aparece en el documento/);

    const [proposed] = (ingest.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed;
    await expect(
      approveIngest({
        client, control, ingest,
        input: { validFrom: "2026-10-01", excludedRowKeys: [rowKey(proposed)] },
        user: { id: "negoco-1" }, today: "2026-10-07",
      }),
    ).rejects.toThrow(/No hay ninguna fila que guardar/);
  });

  test("missing power can be set to the regulated one by the reviewer", async () => {
    const text = "Tarifa 24 horas 0,139 €/kWh";
    const ingest = await ingestWith(
      client,
      extractionResult(
        [rate({ productName: "Tarifa 24 horas", singlePrice: true, energyP1: 0.139, energyP2: null, energyP3: null, powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null })],
        { text },
      ),
      "COM-041",
    );
    const [proposed] = (ingest.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed;
    const key = rowKey(proposed);

    const before = await buildReview({ client, control, ingest, today: "2026-10-07" });
    expect(before?.review.issues).toContainEqual(expect.objectContaining({ code: "missing_power" }));

    const after = await buildReview({
      client, control, ingest, today: "2026-10-07", decisions: { regulatedPowerRowKeys: [key] },
    });
    expect(after?.review.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);

    const approved = await approveIngest({
      client, control, ingest,
      input: { validFrom: "2026-10-05", regulatedPowerRowKeys: [key] },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const [price] = await getVersionPrices(client, approved.versionId!);
    expect(price).toMatchObject({ powerMode: "regulated", energy: { P1: 0.139, P2: 0.139, P3: 0.139 } });
  });

  test("the next annex without power keeps the one chosen before, without asking again", async () => {
    const tariff = (energyP1: number) =>
      rate({ productName: "Tarifa 24 horas", singlePrice: true, energyP1, energyP2: null, energyP3: null, powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null });
    const first = await ingestWith(client, extractionResult([tariff(0.139)], { text: "Tarifa 24 horas 0,139 €/kWh" }), "COM-041");
    const key = rowKey((first.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed[0]);
    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-10-01", regulatedPowerRowKeys: [key] },
      user: { id: "u1" }, today: "2026-10-07",
    });

    // Una semana después, otro anexo de Gana que tampoco da la potencia.
    const next = await ingestWith(client, extractionResult([tariff(0.142)], { text: "Tarifa 24 horas 0,142 €/kWh" }), "COM-041");
    const review = (await buildReview({ client, control, ingest: next, today: "2026-10-08" }))!.review;
    expect(review.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);
    const approved = await approveIngest({ client, control, ingest: next, input: { validFrom: "2026-10-08" }, user: { id: "u1" }, today: "2026-10-08" });
    const [price] = await getVersionPrices(client, approved.versionId!);
    expect(price).toMatchObject({ powerMode: "regulated", energy: { P1: 0.142 } });
  });

  test("the mailbox approves a reading in review whose doubts resolve themselves, and says why when it cannot", async () => {
    const tariff = (energyP1: number) =>
      rate({ productName: "Tarifa 24 horas", singlePrice: true, energyP1, energyP2: null, energyP3: null, powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null });
    const first = await ingestWith(client, extractionResult([tariff(0.139)], { text: "Tarifa 24 horas 0,139 €/kWh" }), "COM-041");
    expect(first.status).toBe("needs_review");
    const auto = (ingest: typeof first) =>
      autoApproveIngest({ client, control, ingest, approvedBy: "email:jorge", receivedOn: "2026-10-08", today: "2026-10-08" });

    // Sin versión anterior no hay de dónde sacar la potencia: se queda, con el motivo.
    expect(await auto(first)).toMatchObject({ approved: false, reason: expect.stringContaining("potencia") });
    expect(summarizeIngest((await getIngest(client, first.id))!).pendingReason).toContain("potencia");

    const key = rowKey((first.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed[0]);
    await approveIngest({ client, control, ingest: first, input: { validFrom: "2026-10-01", regulatedPowerRowKeys: [key] }, user: { id: "u1" }, today: "2026-10-07" });

    // El siguiente anexo tampoco la da, pero ya se hereda: se aprueba solo.
    const next = await ingestWith(client, extractionResult([tariff(0.142)], { text: "Tarifa 24 horas 0,142 €/kWh" }), "COM-041");
    expect(next.status).toBe("needs_review");
    expect(await auto(next)).toMatchObject({ approved: true });

    const nameless = extractionResult([tariff(0.15)], { text: "Tarifa 24 horas 0,15 €/kWh" });
    if (nameless.status !== "out_of_scope") nameless.extraction.supplierName = "Comercializadora que no existe";
    const unknown = await ingestWith(client, nameless, null);
    expect(await auto(unknown)).toMatchObject({ approved: false, reason: "no se ha reconocido la comercializadora del anexo" });
  });

  test("a doubtful row is set aside for Negoco and the rest is approved", async () => {
    // Fénix está en el documento; Unicornio trae una energía que no aparece.
    const ingest = await ingestWith(
      client,
      extractionResult([
        rate({ energyP1: 0.99999 }),
        rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554, powerMode: "regulated", powerUnit: null, powerP1: null, powerP2: null }),
      ]),
      "COM-040",
    );
    expect(ingest.status).toBe("needs_review");
    const result = await autoApproveIngest({ client, control, ingest, approvedBy: "email:jorge", receivedOn: "2026-10-08", today: "2026-10-08" });
    expect(result).toMatchObject({ approved: true, approvedRows: 1, totalRows: 2, pendingIngestId: expect.any(String) });

    const prices = await getVersionPrices(client, (result as { versionId: string }).versionId);
    expect(prices.map(({ rateName }) => rateName)).toEqual(["Fénix"]);

    const pending = (await getIngest(client, (result as { pendingIngestId: string }).pendingIngestId))!;
    expect(pending).toMatchObject({ status: "needs_review", comercializadoraId: "COM-040", createdBy: `comparador:parte-de:${ingest.id}` });
    expect((pending.extraction as { proposed: { productName: string }[] }).proposed.map(({ productName }) => productName)).toEqual(["Unicornio"]);
    expect(summarizeIngest((await getIngest(client, ingest.id))!)).toMatchObject({ status: "approved" });
  });

  test("doubtful commissions wait for Negoco while the prices are approved", async () => {
    const band = { energy: null, accessTariff: "2.0TD", pricing: "fixed" as const, channel: null, minKwh: null, maxKwh: null, ruleType: "fixed" as const, feeBase: null, minKw: null, maxKw: null, minAmount: null };
    const read = extractionResult([rate({})], { commissions: [{ ...band, productName: "Unicornio", level: null, amount: 777 }] });
    if (read.status !== "out_of_scope") read.issues.push(...validateProposedCommissions(toProposedCommissions(read.extraction), QUIMERA_TEXT));
    const ingest = await ingestWith(client, read, "COM-040");
    const result = await autoApproveIngest({ client, control, ingest, approvedBy: "email:jorge", receivedOn: "2026-10-08", today: "2026-10-08" });
    expect(result).toMatchObject({ approved: true, pendingIngestId: expect.any(String) });
    expect(await listCurrentCommissionRules(client, "2026-10-08")).toEqual([]);
    const pending = (await getIngest(client, (result as { pendingIngestId: string }).pendingIngestId))!;
    expect((pending.extraction as { extraction: { commissions: unknown[]; rates: unknown[] } }).extraction).toMatchObject({ rates: [], commissions: [expect.anything()] });
  });

  test("a problem with the whole annex is not approved in part", async () => {
    const result = extractionResult([rate({})]);
    if (result.status !== "out_of_scope") result.issues.push({ severity: "blocking", code: "partial_read", message: "La plantilla no encaja: hoja X." });
    const ingest = await ingestWith(client, result, "COM-040");
    expect(await autoApproveIngest({ client, control, ingest, approvedBy: "email:jorge", receivedOn: "2026-10-08", today: "2026-10-08" })).toEqual({
      approved: false,
      reason: "La plantilla no encaja: hoja X.",
    });
  });

  test("the sender hears about the updated prices once the whole annex is applied", async () => {
    vi.stubEnv("COMPARADOR_PRICE_UPDATE_EMAILS", "1");
    sendMail.mockClear();
    await client.execute("CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, name TEXT, banned INTEGER)");
    await client.execute("INSERT INTO user (id, email, name) VALUES ('u-jorge', 'jorge@beenergy.es', 'Jorge')");
    const request = new Request("https://api.negococloud.es/api/webhooks/resend-tarifas");

    // Unicornio no trae potencia y no hay versión anterior: se aparta.
    const read = extractionResult([
      rate({ powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null }),
      rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554, powerMode: "regulated", powerUnit: null, powerP1: null, powerP2: null }),
    ]);
    const id = await createIngest(client, { channel: "email", comercializadoraId: "COM-040", files: [], bodyText: QUIMERA_TEXT, emailFrom: "Jorge <jorge@beenergy.es>", createdBy: null });
    await processIngest({ client, ingest: (await getIngest(client, id))!, tenantSlug: "beenergy", userId: null, extract: async () => read, readings: null });
    const result = await autoApproveIngest({ client, control, ingest: (await getIngest(client, id))!, approvedBy: "u-jorge", receivedOn: "2026-10-08", today: "2026-10-08" });
    expect(result).toMatchObject({ approved: true, pendingIngestId: expect.any(String) });

    // Falta la parte que revisa Negoco: todavía no se avisa.
    expect(await notifyPricesUpdated({ client, ingest: (await getIngest(client, id))!, tenantSlug: "beenergy", request })).toBe(false);

    const pending = (await getIngest(client, (result as { pendingIngestId: string }).pendingIngestId))!;
    const key = rowKey((pending.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed[0]);
    await approveIngest({ client, control, ingest: pending, input: { validFrom: "2026-10-08", regulatedPowerRowKeys: [key] }, user: { id: "negoco-1" }, today: "2026-10-08" });
    expect(await notifyPricesUpdated({ client, ingest: (await getIngest(client, pending.id))!, tenantSlug: "beenergy", request })).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "jorge@beenergy.es", subject: "Precios de Quimera actualizados" }));
    vi.unstubAllEnvs();
  });

  test("price emails stay off unless they are switched on, and link to each tenant's CRM", async () => {
    vi.stubEnv("COMPARADOR_PRICE_UPDATE_EMAILS", "");
    const ingest = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    expect(await notifyPricesUpdated({ client, ingest, tenantSlug: "beenergy", request: new Request("https://x.es/") })).toBe(false);
    vi.unstubAllEnvs();
    expect(tenantAppUrl("beenergy", new Request("https://beenergy-comparador.negococloud.es/api/v2/x"))).toBe("https://beenergy-comparador.negococloud.es");
    expect(tenantAppUrl("beenergy", new Request("https://api.negococloud.es/api/webhooks/x"), { COMPARADOR_TENANT_URL: "https://{tenant}-comparador.negococloud.es" })).toBe("https://beenergy-comparador.negococloud.es");
    expect(tenantAppUrl("nasertel", undefined, {})).toBe("https://nasertel.negococloud.es");
  });

  test("a base price stays a base price in the next annex, unless the reviewer says otherwise", async () => {
    const first = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    const key = rowKey((first.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed[0]);
    // Negoco marca en la revisión que Unicornio es precio base.
    const approved = await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-10-01", feeOverrides: { [key]: true } }, user: { id: "u1" }, today: "2026-10-07",
    });
    expect((await getVersionPrices(client, approved.versionId!))[0].feeEnergyMinPerMwh).toBe(0);

    // El anexo siguiente no dice nada del fee: lo hereda.
    const next = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    const kept = await approveIngest({ client, control, ingest: next, input: { validFrom: "2026-10-08" }, user: { id: "u1" }, today: "2026-10-08" });
    expect((await getVersionPrices(client, kept.versionId!))[0].feeEnergyMinPerMwh).toBe(0);

    // Y si quien revisa dice que es cerrado, deja de serlo.
    const third = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    const closed = await approveIngest({
      client, control, ingest: third, input: { validFrom: "2026-10-09", feeOverrides: { [key]: false } }, user: { id: "u1" }, today: "2026-10-09",
    });
    expect((await getVersionPrices(client, closed.versionId!))[0].feeEnergyMinPerMwh).toBeNull();
  });

  test("an unread commission section sends the commissions to Negoco, who adds the rule once and it is remembered", async () => {
    const band = { energy: null, accessTariff: "2.0TD", pricing: "fixed" as const, channel: null, minKwh: null, maxKwh: null, ruleType: "fixed" as const, feeBase: null, minKw: null, maxKw: null, minAmount: null };
    const framework = () => {
      const read = extractionResult([], { commissions: [{ ...band, productName: "Unicornio", level: null, amount: 50 }], text: null });
      if (read.status !== "out_of_scope") read.issues.push({ severity: "warning", code: "commission_unread", message: "Hoja «Electricidad», SIMPLEX: no se ha leído ninguna comisión." });
      return read;
    };
    await ingestWith(client, extractionResult([rate({})], { text: null }), "COM-040").then((prices) =>
      approveIngest({ client, control, ingest: prices, input: { validFrom: "2026-10-01" }, user: { id: "u1" }, today: "2026-10-07" }),
    );

    const first = await ingestWith(client, framework(), "COM-040");
    const auto = await autoApproveIngest({ client, control, ingest: first, approvedBy: "email:jorge", receivedOn: "2026-10-08", today: "2026-10-08" });
    expect(auto).toMatchObject({ approved: false, reason: expect.stringContaining("no se ha leído ninguna comisión") });

    // Negoco lo revisa y añade lo que dice la frase: el 70 % del fee.
    const seventy = { product: "Unicornio", energy: "electricity" as const, accessTariff: null, level: null, ruleType: "fee_share" as const, amount: 70 };
    await approveIngest({
      client, control, ingest: (await getIngest(client, first.id))!, input: { validFrom: "2026-10-08", extraCommissions: [seventy] },
      user: { id: "negoco:pablo" }, today: "2026-10-08",
    });
    const rules = await listCurrentCommissionRules(client, "2026-10-08");
    expect(rules.map(({ ruleType, amount }) => [ruleType, amount]).sort()).toEqual([["fee_share", 70], ["fixed", 50]]);

    // El siguiente marco la trae ya, sin que nadie la escriba otra vez.
    const next = await ingestWith(client, framework(), "COM-040");
    const review = (await buildReview({ client, control, ingest: next, today: "2026-10-09" }))!.review;
    expect(review.commissions.filter(({ manual }) => manual).map(({ ruleType, amount }) => [ruleType, amount])).toEqual([["fee_share", 70]]);

    // Un anexo solo de precios no puede llevar reglas a mano: dejaría solo esa.
    const prices = await ingestWith(client, extractionResult([rate({ energyP1: 0.25 })], { text: null }), "COM-040");
    const priceReview = (await buildReview({ client, control, ingest: prices, today: "2026-10-09", decisions: { extraCommissions: [seventy] } }))!.review;
    expect(priceReview.commissions).toEqual([]);
  });

  test("the reviewer can type the power a supplier sends in another document", async () => {
    // Holaluz: los precios en un PDF y la potencia (29,93 €/kW·año) en otro.
    const text = "Clásico 1 precio 0,139 €/kWh";
    const ingest = await ingestWith(
      client,
      extractionResult(
        [rate({ productName: "Clásico 1 precio", singlePrice: true, energyP1: 0.139, energyP2: null, energyP3: null, powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null })],
        { text },
      ),
      "COM-041",
    );
    const [proposed] = (ingest.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed;
    const manualPower = { [rowKey(proposed)]: { p1: 29.93, p2: 29.93 } };

    const review = await buildReview({ client, control, ingest, today: "2026-10-07", decisions: { manualPower } });
    expect(review?.review.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);

    const approved = await approveIngest({
      client, control, ingest,
      input: { validFrom: "2026-10-05", manualPower },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const [price] = await getVersionPrices(client, approved.versionId!);
    expect(price.powerMode).toBe("fixed");
    expect(price.power?.P1).toBeCloseTo(29.93 / 365, 9);
  });

  test("commission rules close the previous ones", async () => {
    const commissions: RateDocumentExtraction["commissions"] = [
      { productName: null, energy: null, accessTariff: "2.0TD", pricing: "fixed", level: "Agencia", channel: null, minKwh: 0, maxKwh: 10000, ruleType: "fixed", feeBase: null, amount: 200, minKw: null, maxKw: null, minAmount: null },
    ];
    const first = await ingestWith(client, extractionResult([rate({})], { commissions }), "COM-040");
    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-01-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const second = await ingestWith(
      client,
      extractionResult([rate({})], { commissions: [{ ...commissions[0], amount: 220 }] }),
      "COM-040",
    );
    await approveIngest({
      client, control, ingest: second, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const { rows } = await client.execute(
      "SELECT amount, valid_from, valid_to FROM rate_commission_rules ORDER BY valid_from",
    );
    expect(rows.map((row) => [row.amount, row.valid_from, row.valid_to])).toEqual([
      [200, "2026-01-01", "2026-09-30"],
      [220, "2026-10-01", null],
    ]);

    // Volver a leer el mismo anexo, con la misma fecha, sustituye sus reglas.
    const reread = await ingestWith(
      client,
      extractionResult([rate({})], { commissions: [{ ...commissions[0], amount: 230 }] }),
      "COM-040",
    );
    await approveIngest({
      client, control, ingest: reread, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const after = await client.execute("SELECT amount, valid_from, valid_to FROM rate_commission_rules ORDER BY valid_from");
    expect(after.rows.map((row) => [row.amount, row.valid_from, row.valid_to])).toEqual([
      [200, "2026-01-01", "2026-09-30"],
      [230, "2026-10-01", null],
    ]);
  });

  test("commission rules keep their product, power limit and minimum, and say which rates they cover", async () => {
    const commissions: RateDocumentExtraction["commissions"] = [
      { productName: "Unicornio", energy: null, accessTariff: "2.0TD", pricing: "fixed", level: "Alto", channel: null, minKwh: null, maxKwh: null, ruleType: "per_mwh", feeBase: null, amount: 15, minKw: 10, maxKw: null, minAmount: 75 },
      { productName: "Helsinki", energy: null, accessTariff: "2.0TD", pricing: "fixed", level: "I", channel: null, minKwh: null, maxKwh: null, ruleType: "fixed", feeBase: null, amount: 4, minKw: null, maxKw: null, minAmount: null },
    ];
    const ingest = await ingestWith(client, extractionResult([rate({ level: "Alto" })], { commissions }), "COM-040");
    const built = await buildReview({ client, control, ingest, today: "2026-10-07" });
    expect(built?.review.commissions.map(({ covers }) => covers)).toEqual([["Unicornio (Alto)"], []]);

    await approveIngest({
      client, control, ingest, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const rules = await listCurrentCommissionRules(client, "2026-10-07");
    expect(rules.find(({ amount }) => amount === 15)).toMatchObject({
      product: "Unicornio", level: "Alto", minKw: 10, maxKw: null, ruleType: "per_mwh", minAmount: 75,
    });
    // Un producto que no casa con ninguna tarifa no convierte la regla en general.
    expect(rules.find(({ amount }) => amount === 4)).toMatchObject({ rateId: null, product: "Helsinki" });
  });

  test("commission levels named unlike the price levels are mapped once and remembered (Axpo S/E/X)", async () => {
    const prices = await ingestWith(
      client,
      extractionResult([rate({ productName: "Estable", level: "SUPER (N1)" }), rate({ productName: "Estable", level: "N2" })]),
      "COM-040",
    );
    await approveIngest({
      client, control, ingest: prices, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });

    const band = { energy: null, accessTariff: "2.0TD", pricing: "fixed" as const, channel: null, minKwh: 1000, maxKwh: 2000, ruleType: "fixed" as const, feeBase: null, minKw: null, maxKw: null, minAmount: null };
    const commissions: RateDocumentExtraction["commissions"] = [
      { ...band, productName: "TARIFA ESTABLE*", level: "S", amount: 18.78 },
      { ...band, productName: "TARIFA ESTABLE*", level: "E", amount: 12.6 },
      { ...band, productName: "1.   Tipo de Producto Campaña:", energy: "gas", accessTariff: "RL.1", level: "N1", amount: 31.5 },
    ];
    const first = await ingestWith(client, extractionResult([], { commissions }), "COM-040");
    const review = (await buildReview({ client, control, ingest: first, today: "2026-10-07" }))!.review;
    // «S» se deduce de «SUPER (N1)»; «E» lo tiene que decir quien revisa.
    expect(review.commissionLevels.map(({ level, mappedTo, source }) => [level, mappedTo, source])).toEqual([
      ["S", "SUPER (N1)", "suggested"],
      ["E", null, null],
    ]);
    expect(review.commissions.map(({ product, level, covers, uncovered }) => [product, level, covers, uncovered])).toEqual([
      ["ESTABLE", "SUPER (N1)", ["Estable (SUPER (N1))"], null],
      ["ESTABLE", "E", [], expect.stringContaining("nivel «E»")],
      // Sin tarifas de gas no se pregunta por sus niveles: se aplicará cuando las haya.
      ["Campaña", "N1", [], expect.stringContaining("Aún no hay tarifas de gas RL.1")],
    ]);

    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-10-01", levelMap: { E: "N2" } },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const rules = await listCurrentCommissionRules(client, "2026-10-07");
    expect(rules.map(({ product, level }) => [product, level]).sort()).toEqual([
      ["Campaña", "N1"],
      ["ESTABLE", "N2"],
      ["ESTABLE", "SUPER (N1)"],
    ]);

    // El anexo siguiente ya sabe a qué equivale cada nivel.
    const next = await ingestWith(client, extractionResult([], { commissions }), "COM-040");
    const remembered = (await buildReview({ client, control, ingest: next, today: "2026-10-07" }))!.review;
    expect(remembered.commissionLevels.map(({ level, mappedTo, source }) => [level, mappedTo, source])).toEqual([
      ["S", "SUPER (N1)", "remembered"],
      ["E", "N2", "remembered"],
    ]);
  });

  test("commissions name the product with its price type and the supplier, and the level inside the rate name (Eleia)", async () => {
    await client.execute("UPDATE comercializadoras SET name = 'Eleia' WHERE id = 'COM-040'");
    const names = [
      "PRODUCTO TU MEDIO AMBIENTE S3826 TMAE 0",
      "PRODUCTO TU MEDIO AMBIENTE S3826 TMAE 1",
      "TRADERPOOL S3826 TRADERPOOL 0",
      "PRODUCTO BALANCE OF ENERGY S3826 Balance Of Energy 0",
      "PRODUCTO BALANCE OF ENERGY S3826 Balance Of Energy 1",
    ];
    const prices = await ingestWith(client, extractionResult(names.map((productName) => rate({ productName }))), "COM-040");
    await approveIngest({
      client, control, ingest: prices, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });

    const band = { energy: null, accessTariff: "2.0TD", pricing: "fixed" as const, channel: null, minKwh: 0, maxKwh: 5000, ruleType: "fixed" as const, feeBase: null, minKw: null, maxKw: null, minAmount: null };
    const commissions: RateDocumentExtraction["commissions"] = [
      { ...band, productName: "TU MEDIO AMBIENTE FIJO", level: "TMAE1", amount: 40 },
      { ...band, productName: "TRADERPOOL INDEXADO", level: "TPoolE0", amount: 30 },
      { ...band, productName: "Balance Of Energy", level: "BOE 1", amount: 20 },
      { ...band, productName: "TU DECIDES ELEIA FIJO", level: "TDE0", amount: 10 },
    ];
    const ingest = await ingestWith(client, extractionResult([], { commissions }), "COM-040");
    const review = (await buildReview({ client, control, ingest, today: "2026-10-07" }))!.review;
    expect(review.commissions.map(({ product, pricing, covers }) => [product, pricing, covers])).toEqual([
      ["TU MEDIO AMBIENTE", "fixed", ["TU MEDIO AMBIENTE TMAE 1"]],
      ["TRADERPOOL", "indexed", ["TRADERPOOL TRADERPOOL 0"]],
      ["Balance Of Energy", "fixed", ["BALANCE OF ENERGY Balance Of Energy 1"]],
      ["TU DECIDES", "fixed", []],
    ]);
    // «TDE0» no casa porque no hay tarifas «Tu Decides»: no es cosa del nivel.
    expect(review.commissionLevels).toEqual([]);
  });

  test("a gas rate called like the product does not take the electricity commissions (Eleia «TU DECIDES»)", async () => {
    await client.execute("UPDATE comercializadoras SET name = 'Eleia' WHERE id = 'COM-040'");
    const gas = rate({
      productName: "TU DECIDES", accessTariff: "RL.1", level: "TDE 0", singlePrice: true,
      energyP1: 0.086731, energyP2: null, energyP3: null,
      powerMode: "fixed", powerUnit: "eur_month", powerP1: 4.231, powerP2: null, gasTollsIncluded: true,
    });
    const electricity = rate({ productName: "PRODUCTO TU DECIDES S3826 TDE 0" });
    const prices = await ingestWith(client, extractionResult([gas, electricity], { text: null }), "COM-040");
    await approveIngest({
      client, control, ingest: prices, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });

    const band = { pricing: "fixed" as const, channel: null, minKwh: 0, maxKwh: 5000, ruleType: "fixed" as const, feeBase: null, minKw: null, maxKw: null, minAmount: null };
    const commissions: RateDocumentExtraction["commissions"] = [
      { ...band, energy: null, accessTariff: "2.0TD", productName: "TU DECIDES ELEIA FIJO", level: "TDE0", amount: 10 },
      { ...band, energy: "gas", accessTariff: "RL.1", productName: "TU DECIDES ELEIA (GAS) PRECIO FIJO", level: "TDE0", amount: 56 },
    ];
    const ingest = await ingestWith(client, extractionResult([], { commissions, text: null }), "COM-040");
    const review = (await buildReview({ client, control, ingest, today: "2026-10-07" }))!.review;
    expect(review.commissions.map(({ energy, covers, uncovered }) => [energy ?? "electricity", covers.length, uncovered])).toEqual([
      ["electricity", 1, null],
      ["gas", 1, null],
    ]);
    // La de luz casa por nombre («TU DECIDES TDE 0»), no atada a la tarifa de gas.
    expect(review.commissions[0].rateId).toBeNull();
    expect(review.commissions[1].rateId).not.toBeNull();
  });

  test("a level with no equivalent offers the rates of its product when they have no levels", async () => {
    const names = ["PRODUCTO SOL S1 Sol 0", "PRODUCTO SOL S1 Sol 1", "PRODUCTO LUNA S1"];
    const prices = await ingestWith(client, extractionResult(names.map((productName) => rate({ productName }))), "COM-040");
    await approveIngest({
      client, control, ingest: prices, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const commissions: RateDocumentExtraction["commissions"] = [
      { productName: "SOL", energy: null, accessTariff: "2.0TD", pricing: "fixed", level: "Oro", channel: null, minKwh: null, maxKwh: null, ruleType: "fixed", feeBase: null, amount: 50, minKw: null, maxKw: null, minAmount: null },
    ];
    const ingest = await ingestWith(client, extractionResult([], { commissions }), "COM-040");
    const review = (await buildReview({ client, control, ingest, today: "2026-10-07" }))!.review;
    expect(review.commissionLevels.map(({ level, options }) => [level, options])).toEqual([
      ["Oro", ["SOL S1 Sol 0", "SOL S1 Sol 1"]],
    ]);
    const chosen = (await buildReview({
      client, control, ingest, today: "2026-10-07", decisions: { levelMap: { Oro: "SOL S1 Sol 1" } },
    }))!.review;
    expect(chosen.commissions[0].covers).toEqual(["SOL S1 Sol 1"]);
  });

  test("the same annex in another tenant reuses the reading; the same file approved again is a duplicate", async () => {
    const readings = memoryReadingCache();
    const files = [{ path: "comparador/x/tarifas/1/anexo.txt", name: "anexo.txt", mime: "text/plain", size: 10 }];
    let calls = 0;
    const read = async (tenant: Client, ingestId: string) =>
      processIngest({
        client: tenant,
        ingest: (await getIngest(tenant, ingestId))!,
        tenantSlug: "t",
        userId: null,
        readFile: async () => new TextEncoder().encode(QUIMERA_TEXT),
        extract: async () => {
          calls++;
          return extractionResult([rate({})]);
        },
        readings,
      });

    const first = await createIngest(client, { channel: "email", comercializadoraId: "COM-040", files, createdBy: null });
    expect(await read(client, first)).toBe("ready");
    const other = await tenantDb();
    const shared = await createIngest(other, { channel: "email", comercializadoraId: "COM-040", files, createdBy: null });
    expect(await read(other, shared)).toBe("ready");
    expect(calls).toBe(1);
    expect((await getIngest(other, shared))?.costUsd).toBeNull();

    // En el primer tenant se aprueba; si alguien lo reenvía, no se lee ni se aprueba otra vez.
    await approveIngest({ client, control, ingest: (await getIngest(client, first))!, input: { validFrom: "2026-10-01" }, user: { id: "u1" }, today: "2026-10-07" });
    const again = await createIngest(client, { channel: "email", comercializadoraId: "COM-040", files, createdBy: null });
    expect(await read(client, again)).toBe("rejected");
    expect((await getIngest(client, again))?.error).toContain("ya se aprobó");
    expect(calls).toBe(1);
  });

  test("a doubtful reading is not shared with other tenants", async () => {
    const readings = memoryReadingCache();
    const files = [{ path: "comparador/x/tarifas/1/anexo.txt", name: "anexo.txt", mime: "text/plain", size: 10 }];
    const id = await createIngest(client, { channel: "email", comercializadoraId: "COM-040", files, createdBy: null });
    await processIngest({
      client, ingest: (await getIngest(client, id))!, tenantSlug: "t", userId: null,
      readFile: async () => new TextEncoder().encode(QUIMERA_TEXT),
      extract: async () => extractionResult([rate({ energyP1: 0.99 })]),
      readings,
    });
    expect((await getIngest(client, id))?.status).toBe("needs_review");
    expect(readings.entries.size).toBe(0);
  });

  test("reading the same file again replaces the pending reading", async () => {
    const files = [{ path: "comparador/test/tarifas/x/anexo.txt", name: "anexo.txt", mime: "text/plain", size: 10 }];
    const read = async (ingestId: string) => {
      await processIngest({
        client,
        ingest: (await getIngest(client, ingestId))!,
        tenantSlug: "test",
        userId: "user-1",
        readFile: async () => new TextEncoder().encode(QUIMERA_TEXT),
        extract: async () => extractionResult([rate({})]),
        readings: null,
      });
    };
    const first = await createIngest(client, { channel: "upload", comercializadoraId: "COM-040", files, createdBy: "user-1" });
    await read(first);
    const second = await createIngest(client, { channel: "upload", comercializadoraId: "COM-040", files, createdBy: "user-1" });
    await read(second);
    expect((await getIngest(client, first))?.status).toBe("rejected");
    expect((await getIngest(client, second))?.status).toBe("ready");
  });

  test("a new version cannot start before the active one", async () => {
    const first = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    const older = await ingestWith(client, extractionResult([rate({ energyP1: 0.2 })]), "COM-040");
    await expect(
      approveIngest({
        client, control, ingest: older, input: { validFrom: "2026-01-01" },
        user: { id: "negoco-1" }, today: "2026-10-07",
      }),
    ).rejects.toThrow("no puede ser anterior");
  });

  test("only active suppliers make offers", async () => {
    const ingest = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    await approveIngest({
      client, control, ingest, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    expect((await listActiveOfferPrices(client, "2026-10-07")).map(({ comercializadoraId }) => comercializadoraId)).toEqual(["COM-040"]);
    await client.execute("UPDATE comercializadoras SET active = 0 WHERE id = 'COM-040'");
    expect(await listActiveOfferPrices(client, "2026-10-07")).toEqual([]);
  });

  test("commission figures must appear in the document", () => {
    const text = "2.0TD > 10 kW  Agencia 0 - 10 MWh 200 €   Estándar 150 €";
    expect(validateProposedCommissions([{ amount: 200, minAmount: null }, { amount: 150, minAmount: null }], text)).toEqual([]);
    expect(validateProposedCommissions([{ amount: 220, minAmount: 75 }], text)).toMatchObject([
      { severity: "blocking", code: "commission_not_in_source" },
    ]);
    // Sin texto (imagen) no se puede comprobar.
    expect(validateProposedCommissions([{ amount: 220, minAmount: null }], null)).toEqual([]);
  });

  test("a commissions-only document never retires prices, and a product family can be kept", async () => {
    const first = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });

    // Nordy: un PDF de comisiones, sin precios.
    const commissions: RateDocumentExtraction["commissions"] = [
      { productName: null, energy: null, accessTariff: "2.0TD", pricing: "fixed", level: null, channel: null, minKwh: null, maxKwh: null, ruleType: "fixed", feeBase: null, amount: 90, minKw: null, maxKw: null, minAmount: null },
    ];
    const onlyCommissions = await ingestWith(client, extractionResult([], { commissions }), "COM-040");
    const commissionReview = await buildReview({ client, control, ingest: onlyCommissions, today: "2026-10-07" });
    expect(commissionReview?.review.entries.map(({ kind }) => kind)).toEqual(["carried"]);
    // Al aprobarlo solo se guardan las comisiones: la versión de precios no cambia.
    const before = await getActiveVersion(client, "COM-040", "2026-10-07");
    const approved = await approveIngest({
      client, control, ingest: onlyCommissions, input: { validFrom: "2026-09-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });
    expect(approved.versionId).toBeNull();
    expect((await getActiveVersion(client, "COM-040", "2026-10-07"))?.id).toBe(before?.id);

    // Quimera: el anexo de Fénix no trae Unicornio. Por defecto lo retira; el
    // revisor puede mantenerlo.
    const fenix = await ingestWith(
      client,
      extractionResult([rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554 })]),
      "COM-040",
    );
    const replacing = await buildReview({ client, control, ingest: fenix, today: "2026-10-07" });
    expect(replacing?.review.entries.map(({ kind }) => kind).sort()).toEqual(["added", "removed"]);
    const keeping = await buildReview({
      client, control, ingest: fenix, today: "2026-10-07", decisions: { partialUpdate: true },
    });
    expect(keeping?.review.entries.map(({ kind }) => kind).sort()).toEqual(["added", "carried"]);
  });

  test("copies the active prices to the demo tenant by catalog link", async () => {
    const ingest = await ingestWith(client, extractionResult([rate({})]), "COM-040");
    await approveIngest({
      client, control, ingest, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, today: "2026-10-07",
    });

    // En el tenant de demo Quimera tiene otro COM-xxx.
    const demo = await tenantDb();
    await demo.execute("UPDATE comercializadoras SET id = 'COM-099' WHERE id = 'COM-040'");
    const { planRatesCopy } = await import("./copy");
    const plan = await planRatesCopy({ from: client, to: demo, today: "2026-10-07", userId: "copy" });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({ supplier: "Quimera", rows: 1, newRates: ["Unicornio"] });

    await demo.batch(plan.entries[0].statements, "write");
    const active = await getActiveVersion(demo, "COM-099", "2026-10-07");
    expect(active).toMatchObject({ source: "copy", validFrom: "2026-10-01" });
    const [price] = await getVersionPrices(demo, active!.id);
    expect(price.energy).toEqual({ P1: 0.24755, P2: 0.17927, P3: 0.15329 });
  });

  test("out of scope documents are kept but not reviewable", async () => {
    const ingest = await ingestWith(
      client,
      {
        status: "out_of_scope",
        reason: "Solo trae 3.0TD, 6.1TD; la v1 compara 2.0TD.",
        classification: { supplierName: "Quimera", hasPrices: true, hasCommissions: false, accessTariffs: ["3.0TD", "6.1TD"], pricing: ["fixed"] },
        costUsd: 0.0002,
      },
      null,
    );
    expect(ingest).toMatchObject({ status: "out_of_scope", comercializadoraId: "COM-040" });
    expect(await buildReview({ client, control, ingest, today: "2026-10-07" })).toBeNull();
  });
});

describe("dayInSpain", () => {
  test("an email received at 22:45 UTC in summer arrived the next day in Spain", async () => {
    const { dayInSpain } = await import("./service");
    expect(dayInSpain("2026-10-16 22:45:34")).toBe("2026-10-17");
    expect(dayInSpain("2026-10-16 10:45:34")).toBe("2026-10-16");
    expect(dayInSpain("2026-10-16T22:45:34Z")).toBe("2026-10-17");
  });
});
