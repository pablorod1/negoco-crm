// @vitest-environment node
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import type { RateExtractionResult } from "./extract";
import { toProposedRates } from "./normalize";
import {
  createIngest,
  getActiveVersion,
  getIngest,
  getVersionPrices,
  listCatalog,
  listCurrentCommissionRules,
  listTenantRates,
} from "./repository";
import type { ExtractedRate, RateDocumentExtraction } from "./schema";
import { approveIngest, buildReview, processIngest, RateIngestError } from "./service";
import { rowKey, validateProposedCommissions, validateProposedRates } from "./validate";

const MIGRATIONS = join(process.cwd(), "migrations");
const sql = (name: string) => readFileSync(join(MIGRATIONS, name), "utf8");

async function tenantDb(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE comercializadoras (id TEXT PRIMARY KEY, name TEXT, active INTEGER);
    CREATE TABLE comercializadora_rates (id TEXT PRIMARY KEY NOT NULL, name TEXT, price REAL,
      created_at TEXT, updated_at TEXT, comercializadora_id TEXT, type TEXT, provider TEXT,
      descripcion TEXT);
    INSERT INTO comercializadoras VALUES ('COM-040', 'Quimera', 1), ('COM-041', 'Gana Energía', 1);
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
    feeMinMwh: null,
    feeMaxMwh: null,
    feeOnPower: false,
    discounts: [],
    ...overrides,
  };
}

function extractionResult(
  rates: ExtractedRate[],
  { partialUpdate = false, text = QUIMERA_TEXT as string | null, commissions = [] as RateDocumentExtraction["commissions"] } = {},
): RateExtractionResult {
  const extraction: RateDocumentExtraction = {
    supplierName: "Quimera Infinita",
    documentKind: commissions.length ? "prices_and_commissions" : "prices",
    validFrom: "2026-10-01",
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

  test("detects the supplier, and only Negoco can add new products to the catalog", async () => {
    const ingest = await ingestWith(
      client,
      extractionResult([rate({}), rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554, powerMode: "regulated", powerUnit: null, powerP1: null, powerP2: null })]),
      null,
    );
    expect(ingest).toMatchObject({ status: "ready", comercializadoraId: "COM-040" });

    const built = await buildReview({ client, control, ingest, today: "2026-10-07" });
    expect(built?.review.newProducts).toEqual(["Unicornio", "Fénix"]);
    expect(built?.review.entries.map(({ kind }) => kind)).toEqual(["added", "added"]);

    await expect(
      approveIngest({
        client,
        control,
        ingest,
        input: { validFrom: "2026-10-01" },
        user: { id: "user-1" },
        isCatalogAdmin: false,
        today: "2026-10-07",
      }),
    ).rejects.toMatchObject({ status: 403 });

    const approved = await approveIngest({
      client,
      control,
      ingest,
      input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" },
      isCatalogAdmin: true,
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

  test("a partial update keeps untouched rates and can be scheduled", async () => {
    // Primera versión: Unicornio y Fénix ya en el catálogo y en el tenant.
    const first = await ingestWith(
      client,
      extractionResult([rate({}), rate({ productName: "Fénix", energyP1: 0.23011, energyP2: 0.1612, energyP3: 0.13554 })]),
      "COM-040",
    );
    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
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

    // Un backoffice (sin ser de Negoco) puede aprobarla: no hay productos nuevos.
    const scheduled = await approveIngest({
      client, control, ingest: partial, input: { validFrom: "2026-10-15" },
      user: { id: "backoffice-1" }, isCatalogAdmin: false, today: "2026-10-07",
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
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
    });
    await expect(attempt).rejects.toBeInstanceOf(RateIngestError);
    await expect(attempt).rejects.toThrow(/no aparece en el documento/);

    const [proposed] = (ingest.extraction as { proposed: Parameters<typeof rowKey>[0][] }).proposed;
    await expect(
      approveIngest({
        client, control, ingest,
        input: { validFrom: "2026-10-01", excludedRowKeys: [rowKey(proposed)] },
        user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
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
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
    });
    const [price] = await getVersionPrices(client, approved.versionId!);
    expect(price).toMatchObject({ powerMode: "regulated", energy: { P1: 0.139, P2: 0.139, P3: 0.139 } });
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
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
    });
    const [price] = await getVersionPrices(client, approved.versionId!);
    expect(price.powerMode).toBe("fixed");
    expect(price.power?.P1).toBeCloseTo(29.93 / 365, 9);
  });

  test("commission rules close the previous ones", async () => {
    const commissions: RateDocumentExtraction["commissions"] = [
      { productName: null, accessTariff: "2.0TD", pricing: "fixed", level: "Agencia", channel: null, minKwh: 0, maxKwh: 10000, ruleType: "fixed", feeBase: null, amount: 200, minKw: null, maxKw: null, minAmount: null },
    ];
    const first = await ingestWith(client, extractionResult([rate({})], { commissions }), "COM-040");
    await approveIngest({
      client, control, ingest: first, input: { validFrom: "2026-01-01" },
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
    });
    const second = await ingestWith(
      client,
      extractionResult([rate({})], { commissions: [{ ...commissions[0], amount: 220 }] }),
      "COM-040",
    );
    await approveIngest({
      client, control, ingest: second, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
    });
    const { rows } = await client.execute(
      "SELECT amount, valid_from, valid_to FROM rate_commission_rules ORDER BY valid_from",
    );
    expect(rows.map((row) => [row.amount, row.valid_from, row.valid_to])).toEqual([
      [200, "2026-01-01", "2026-09-30"],
      [220, "2026-10-01", null],
    ]);
  });

  test("commission rules keep their product, power limit and minimum, and say which rates they cover", async () => {
    const commissions: RateDocumentExtraction["commissions"] = [
      { productName: "Unicornio", accessTariff: "2.0TD", pricing: "fixed", level: "Alto", channel: null, minKwh: null, maxKwh: null, ruleType: "per_mwh", feeBase: null, amount: 15, minKw: 10, maxKw: null, minAmount: 75 },
      { productName: "Helsinki", accessTariff: "2.0TD", pricing: "fixed", level: "I", channel: null, minKwh: null, maxKwh: null, ruleType: "fixed", feeBase: null, amount: 4, minKw: null, maxKw: null, minAmount: null },
    ];
    const ingest = await ingestWith(client, extractionResult([rate({ level: "Alto" })], { commissions }), "COM-040");
    const built = await buildReview({ client, control, ingest, today: "2026-10-07" });
    expect(built?.review.commissions.map(({ covers }) => covers)).toEqual([["Unicornio (Alto)"], []]);

    await approveIngest({
      client, control, ingest, input: { validFrom: "2026-10-01" },
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
    });
    const rules = await listCurrentCommissionRules(client, "2026-10-07");
    expect(rules.find(({ amount }) => amount === 15)).toMatchObject({
      product: "Unicornio", level: "Alto", minKw: 10, maxKw: null, ruleType: "per_mwh", minAmount: 75,
    });
    // Un producto que no casa con ninguna tarifa no convierte la regla en general.
    expect(rules.find(({ amount }) => amount === 4)).toMatchObject({ rateId: null, product: "Helsinki" });
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
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
    });

    // Nordy: un PDF de comisiones, sin precios.
    const commissions: RateDocumentExtraction["commissions"] = [
      { productName: null, accessTariff: "2.0TD", pricing: "fixed", level: null, channel: null, minKwh: null, maxKwh: null, ruleType: "fixed", feeBase: null, amount: 90, minKw: null, maxKw: null, minAmount: null },
    ];
    const onlyCommissions = await ingestWith(client, extractionResult([], { commissions }), "COM-040");
    const commissionReview = await buildReview({ client, control, ingest: onlyCommissions, today: "2026-10-07" });
    expect(commissionReview?.review.entries.map(({ kind }) => kind)).toEqual(["carried"]);

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
      user: { id: "negoco-1" }, isCatalogAdmin: true, today: "2026-10-07",
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
