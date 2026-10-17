// @vitest-environment node
import { createClient } from "@libsql/client";
import { describe, expect, test } from "vitest";
import { proposalView } from "@/comparador/server/study-route";
import type { ProposalRecord } from "./proposals";
import { commissionAudience, loadSalesCommissionRules, salesCommission } from "./sales-commission";

async function tenant() {
  const db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE default_company_commissions (id TEXT, comercializadora_id TEXT, segment TEXT, commission_type TEXT, commission_value REAL);
    CREATE TABLE user_company_commissions (id TEXT, user_id TEXT, comercializadora_id TEXT, segment TEXT, commission_type TEXT, commission_value REAL);
    INSERT INTO default_company_commissions VALUES ('d1', 'COM-005', 'luz_20td', 'percent', 50), ('d2', 'COM-007', 'gas', 'fixed', 20);
    INSERT INTO user_company_commissions VALUES ('u1', 'jorge', 'COM-005', 'luz_20td', 'percent', 75);
  `);
  return db;
}

describe("the commission each user sees", () => {
  test("a salesperson sees their own share, the agency default if they have none, and nothing without configuration", async () => {
    const db = await tenant();
    const jorge = await loadSalesCommissionRules(db, "jorge");
    const ana = await loadSalesCommissionRules(db, "ana");
    const offer = (comercializadoraId: string, energy: "electricity" | "gas", agencyCommission: number | null) => ({ comercializadoraId, energy, agencyCommission });

    expect(salesCommission(jorge, offer("COM-005", "electricity", 120))).toBe(90); // su 75 %
    expect(salesCommission(ana, offer("COM-005", "electricity", 120))).toBe(60); // el 50 % de la asesoría
    expect(salesCommission(ana, offer("COM-007", "gas", 70))).toBe(20); // fijo de la asesoría
    expect(salesCommission(ana, offer("COM-007", "electricity", 70))).toBeNull(); // sin regla de luz
    expect(salesCommission(ana, offer("COM-099", "electricity", 70))).toBeNull(); // sin configuración
    expect(salesCommission(ana, offer("COM-007", "gas", null))).toBeNull(); // sin comisión de agencia, ni la fija
  });

  test("direction and backoffice see the agency commission; a salesperson never does", async () => {
    const db = await tenant();
    expect(await commissionAudience(db, { id: "x", role: "admin" })).toEqual({ kind: "agency" });
    expect(await commissionAudience(db, { id: "x", role: "1" })).toEqual({ kind: "agency" });
    const sales = await commissionAudience(db, { id: "jorge", role: "2" });
    const proposal = { id: "p", number: 1, offerKey: "k", comercializadoraId: "COM-005", comercializadoraName: "Eleia", productName: "SIMPLEX", feeEnergyPerMwh: 30, annualTotal: 900, savings: 100, commission: 120, createdAt: "", chosenAt: null, document: { offer: { pricing: "fixed" } } } as unknown as ProposalRecord;
    expect(proposalView(proposal, { kind: "agency" }, "electricity").commission).toBe(120);
    expect(proposalView(proposal, sales, "electricity").commission).toBe(90);
  });
});
