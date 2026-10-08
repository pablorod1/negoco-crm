// @vitest-environment node
import { describe, expect, test } from "vitest";
import { createClient } from "@libsql/client";
import { naturgyInvoice } from "@/comparador/extraction/fixtures";
import { validateInvoice } from "@/comparador/extraction/validate";
import { needsInvoiceReview, saveInvoiceReview, type ReviewedExtraction } from "./invoice-review";
import type { StudyRecord } from "./repository";

// La IA leyó mal el precio de potencia P1: la línea deja de cuadrar.
const misread = {
  ...naturgyInvoice,
  powerLines: naturgyInvoice.powerLines.map((line, index) => (index === 0 ? { ...line, pricePerKwDay: 0.21303 } : line)),
};

async function setup() {
  const db = createClient({ url: ":memory:" });
  await db.execute("CREATE TABLE comparison_studies (id TEXT PRIMARY KEY, extraction TEXT, issues TEXT, updated_at TEXT)");
  const issues = validateInvoice(misread);
  await db.execute({ sql: "INSERT INTO comparison_studies (id, extraction, issues) VALUES ('s1', ?, ?)", args: [JSON.stringify(misread), JSON.stringify(issues)] });
  const study = { id: "s1", status: "analyzed", extraction: misread, issues } as unknown as StudyRecord;
  return { db, study };
}

const stored = async (db: ReturnType<typeof createClient>) => {
  const { rows } = await db.execute("SELECT extraction, issues FROM comparison_studies WHERE id = 's1'");
  return { extraction: JSON.parse(String(rows[0].extraction)) as ReviewedExtraction, issues: JSON.parse(String(rows[0].issues)) as unknown[] };
};

describe("invoice review", () => {
  test("a reading that does not add up needs a review; a closed study never does", async () => {
    const { study } = await setup();
    expect(needsInvoiceReview(study)).toBe(true);
    expect(needsInvoiceReview({ ...study, status: "closed" })).toBe(false);
    expect(needsInvoiceReview({ ...study, issues: validateInvoice(naturgyInvoice) })).toBe(false);
  });

  test("the corrected invoice is saved with the AI reading kept apart", async () => {
    const { db, study } = await setup();
    const user = { id: "u1", email: "revisa@example.com" };
    await saveInvoiceReview({ client: db, study, invoice: naturgyInvoice, acceptMismatch: false, user, now: "2026-10-08T18:00:00Z" });
    const { extraction, issues } = await stored(db);
    expect(issues).toEqual([]);
    expect(extraction.powerLines[0].pricePerKwDay).toBe(0.12303);
    expect(extraction.review).toMatchObject({ reviewedBy: "u1", acceptedMismatch: false });
    expect(extraction.review?.original.powerLines[0].pricePerKwDay).toBe(0.21303);
    expect(needsInvoiceReview({ ...study, extraction, issues: [] as never })).toBe(false);
  });

  test("still not adding up is only saved if the person confirms it", async () => {
    const { db, study } = await setup();
    const user = { id: "u1", email: null };
    await expect(saveInvoiceReview({ client: db, study, invoice: misread, acceptMismatch: false, user })).rejects.toThrow(/siguen sin cuadrar/);
    await saveInvoiceReview({ client: db, study, invoice: misread, acceptMismatch: true, user });
    const { extraction } = await stored(db);
    expect(extraction.review?.acceptedMismatch).toBe(true);
    expect(needsInvoiceReview({ ...study, extraction })).toBe(false);
  });
});
