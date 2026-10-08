// @vitest-environment node
import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CostBreakdown } from "@/comparador/engine/types";
import { StudyClientDataSchema } from "./client-data";
import { closeStudy, type ProposalUploader } from "./close";
import { createProposal, findSameProposal, listProposals, proposalFileName } from "./proposals";
import type { StudyOffer } from "./ranking";
import { createStudy, getStudy, type StudyRecord } from "./repository";

const cost = (total: number): CostBreakdown => ({
  days: 365,
  power: { P1: 60, P2: 10, total: 70 },
  energy: { P1: 100, P2: 80, P3: 60, total: 240 },
  energyDiscounts: [],
  otherElectricity: 0,
  socialBonus: 9,
  electricitySubtotal: 319,
  electricityTax: 16,
  meterRental: 9.7,
  services: 0,
  taxableBase: 344.7,
  vat: 72.39,
  vatExempt: 0,
  total,
});

const offer = (overrides: Partial<StudyOffer> = {}): StudyOffer => ({
  key: "price-1",
  comercializadoraId: "COM-005",
  comercializadoraName: "Eleia",
  rateId: "rate-1",
  productName: "TRADERPOOL 3",
  level: null,
  segment: null,
  channel: null,
  termMonths: 12,
  powerMode: "fixed",
  prices: { power: { P1: 0.08, P2: 0.01 }, energy: { P1: 0.15, P2: 0.08, P3: 0.05 } },
  feeEnergyPerMwh: 0,
  feeRange: null,
  cost: cost(480),
  savings: 88,
  commission: 45,
  discounts: [],
  versionValidFrom: "2026-10-01",
  ...overrides,
});

let dir: string;
let client: Client;
let study: StudyRecord;

const migration = (file: string) =>
  readFileSync(path.join(process.cwd(), "migrations", file), "utf8");

beforeEach(async () => {
  // En un fichero: la transacción de libsql abre otra conexión y con
  // :memory: vería una base vacía.
  dir = mkdtempSync(path.join(tmpdir(), "proposals-"));
  client = createClient({ url: `file:${path.join(dir, "tenant.db")}` });
  await client.executeMultiple(`
    CREATE TABLE organization (id TEXT PRIMARY KEY);
    INSERT INTO organization (id) VALUES ('org-1');
    CREATE TABLE comparativas (
      id TEXT PRIMARY KEY, status TEXT, plan TEXT, client TEXT, company_id TEXT,
      commission_segment TEXT, commission_segment_origin TEXT, comision_fijo REAL);
    INSERT INTO comparativas (id, status, plan, client) VALUES ('cmp-1', 'pending', '["indexado"]', 'Cliente');
    CREATE TABLE comparativa_files (
      id TEXT PRIMARY KEY, comparativa_id TEXT, filename TEXT, size INTEGER, extension TEXT,
      upload_date TEXT, download_url TEXT, preview_url TEXT);
    CREATE TABLE comparativa_changes (
      id TEXT PRIMARY KEY, comparativa_id TEXT, user_id TEXT, change_type TEXT, field_name TEXT,
      old_value TEXT, new_value TEXT, description TEXT, created_at TEXT);
  `);
  await client.executeMultiple(migration("026_comparison_studies.sql"));
  await client.executeMultiple(migration("027_comparison_study_proposals.sql"));
  await client.executeMultiple(migration("028_comparison_studies_client.sql"));
  const id = await createStudy(client, {
    comparativaId: "cmp-1",
    status: "analyzed",
    invoiceFileId: null,
    invoiceFileName: "factura.pdf",
    cups: "ES0000000000000000XX0F",
    extraction: null,
    issues: [],
    supply: {
      contractedKw: { P1: 3.3, P2: 3.3 },
      annualKwh: { P1: 900, P2: 900, P3: 1200 },
      consumptionSource: "sips",
      sipsMonths: 12,
      territory: "peninsula",
      territorySource: "sips",
      power: null,
    },
    options: { channel: "acquisition", feeEnergyPerMwh: null, order: "savings" },
    priceDate: "2026-10-08",
    aiCostUsd: 0.006,
    error: null,
    createdBy: "user-1",
  });
  study = (await getStudy(client, id))!;
});

afterEach(() => {
  client.close();
  rmSync(dir, { recursive: true, force: true });
});

const propose = (overrides: Partial<StudyOffer> = {}) =>
  createProposal(client, {
    study,
    offer: offer(overrides),
    current: cost(568),
    currentPrices: null,
    clientName: "Cliente",
    createdBy: "user-1",
  });

describe("proposals", () => {
  test("numbers proposals within the study and keeps the commission out of the PDF", async () => {
    const first = await propose();
    const second = await propose({ key: "price-2", comercializadoraName: "Repsol", productName: "Fijo 12M" });

    expect([first.number, second.number]).toEqual([1, 2]);
    expect(second.document).toMatchObject({ number: 2, client: { name: "Cliente" }, savings: 88 });
    expect(JSON.stringify(second.document)).not.toMatch(/commission|fee/i);
    expect(second.commission).toBe(45);
  });

  test("the same offer with the same fee is the same proposal; another fee is a new one", async () => {
    const proposals = [await propose()];
    expect(findSameProposal(proposals, offer())?.id).toBe(proposals[0].id);
    expect(findSameProposal(proposals, offer({ feeEnergyPerMwh: 10, cost: cost(490) }))).toBeUndefined();
  });

  test("file names keep accents and drop what a file system dislikes", () => {
    expect(
      proposalFileName({ number: 3, comercializadoraName: "Energía / Ñ", productName: 'Tarifa "Única" 2.0TD' }),
    ).toBe("Propuesta 3 - Energía Ñ - Tarifa Única 2.0TD.pdf");
  });
});

describe("close study", () => {
  const uploader = () => {
    const remove = vi.fn(async () => undefined);
    const upload = vi.fn<ProposalUploader>(async () => ({ downloadUrl: "https://storage/propuesta.pdf", remove }));
    return { upload, remove };
  };

  test("the chosen proposal becomes a document and the comparativa awaits review", async () => {
    await propose({ key: "price-2" });
    const chosen = await propose();
    const { upload } = uploader();

    const { fileId } = await closeStudy({ client, study, proposal: chosen, pdf: new Uint8Array([1, 2, 3]), userId: "user-1", upload });

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/^org-1\/comparativas\/cmp-1\/.+Propuesta 2 - Eleia/) }),
    );
    const comparativa = (await client.execute("SELECT * FROM comparativas")).rows[0];
    expect(comparativa).toMatchObject({
      status: "awaiting_review",
      company_id: "COM-005",
      commission_segment: "luz_20td",
      commission_segment_origin: "tariff",
      comision_fijo: 45,
      plan: '["indexado","fijo"]',
    });
    const file = (await client.execute("SELECT * FROM comparativa_files")).rows[0];
    expect(file).toMatchObject({ id: fileId, comparativa_id: "cmp-1", download_url: "https://storage/propuesta.pdf", size: 3 });

    const proposals = await listProposals(client, study.id);
    expect(proposals.map(({ chosenAt }) => chosenAt !== null)).toEqual([false, true]);
    const closed = await getStudy(client, study.id);
    expect(closed).toMatchObject({ status: "closed", chosenTotal: 480, savings: 88, commission: 45, currentTotal: 568 });
    expect(closed?.chosenOffer).toMatchObject({ proposalId: chosen.id, number: 2 });

    const changes = (await client.execute("SELECT change_type FROM comparativa_changes ORDER BY change_type")).rows;
    expect(changes.map(({ change_type }) => change_type)).toEqual([
      "commission_update",
      "document_upload",
      "field_update",
      "plan_update",
      "status_change",
    ]);
  });

  test("the client data written at completion is kept for the trámite", async () => {
    const { upload } = uploader();
    const clientData = StudyClientDataSchema.parse({
      name: "Ana", lastName: "García", kind: "Particular", documentNumber: "12345678Z",
      iban: "ES91 2100 0418 4502 0005 1332", postalCode: "28001", city: "Madrid", province: "Madrid",
    });
    await closeStudy({ client, study, proposal: await propose(), pdf: new Uint8Array([1]), userId: "user-1", upload, clientData });
    expect((await getStudy(client, study.id))?.clientData).toMatchObject({
      name: "Ana", documentNumber: "12345678Z", email: null, postalCode: "28001",
    });
  });

  test("a commission that was already set is not overwritten", async () => {
    await client.execute("UPDATE comparativas SET comision_fijo = 30");
    const { upload } = uploader();
    await closeStudy({ client, study, proposal: await propose(), pdf: new Uint8Array([1]), userId: "user-1", upload });
    expect((await client.execute("SELECT comision_fijo FROM comparativas")).rows[0].comision_fijo).toBe(30);
  });

  test("a comparativa that is no longer pending is not closed nor uploaded to", async () => {
    await client.execute("UPDATE comparativas SET status = 'completed'");
    const { upload } = uploader();
    await expect(
      closeStudy({ client, study, proposal: await propose(), pdf: new Uint8Array([1]), userId: "user-1", upload }),
    ).rejects.toThrow("ya no está pendiente");
    expect(upload).not.toHaveBeenCalled();
  });

  test("if saving fails after the upload, the PDF is removed and nothing changes", async () => {
    await client.execute("DROP TABLE comparativa_files");
    const { upload, remove } = uploader();
    await expect(
      closeStudy({ client, study, proposal: await propose(), pdf: new Uint8Array([1]), userId: "user-1", upload }),
    ).rejects.toThrow();
    expect(remove).toHaveBeenCalled();
    expect((await getStudy(client, study.id))?.status).toBe("analyzed");
    expect((await client.execute("SELECT status FROM comparativas")).rows[0].status).toBe("pending");
  });
});

describe("client data", () => {
  test("everything is optional, but what is written must be valid", () => {
    expect(StudyClientDataSchema.parse({})).toMatchObject({ name: null, documentNumber: null, iban: null });
    expect(StudyClientDataSchema.parse({ name: "  ", email: "" })).toMatchObject({ name: null, email: null });
    for (const wrong of [{ documentNumber: "12345678A" }, { iban: "ES91 2100 0418 4502 0005 1333" }, { email: "ana@" }, { postalCode: "2800" }]) {
      expect(StudyClientDataSchema.safeParse(wrong).success).toBe(false);
    }
  });
});

describe("study metrics", () => {
  test("counts analyses, completed studies and those that became a trámite, by month", async () => {
    const { studyMetrics } = await import("./metrics");
    await client.execute("ALTER TABLE comparativas ADD COLUMN tramite_id TEXT");
    const { upload } = { upload: vi.fn<ProposalUploader>(async () => ({ downloadUrl: "u", remove: async () => undefined })) };
    await closeStudy({ client, study, proposal: await propose(), pdf: new Uint8Array([1]), userId: "user-1", upload });
    await createStudy(client, { ...study, status: "analyzed", createdBy: "user-1" });
    await client.execute("UPDATE comparativas SET tramite_id = 'TRM-1', status = 'processed'");
    const month = (await client.execute("SELECT substr(created_at, 1, 7) AS m FROM comparison_studies LIMIT 1")).rows[0].m;

    expect(await studyMetrics(client, "2000-01-01")).toEqual([
      { month, analyses: 2, completed: 1, inTramite: 1, aiCostUsd: 0.012, averageSavings: 88 },
    ]);
  });
});
