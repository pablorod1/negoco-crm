// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client, type Transaction } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AbarcaWebhookSchema } from "@/comparativas/types/abarca.types";
import type { StudyResultDecision, StudyPlan } from "@/comparativas/types/study-result.types";
import { confirmStudyResult, getStudyResult, receiveStudyResult, StudyResultDecisionSchema } from "./study-result";

let db: Client;
let fixtureDirectory: string;
const migration = readFileSync(new URL("../../../migrations/019_comparison_study_results.sql", import.meta.url), "utf8");
beforeEach(async () => {
  fixtureDirectory = mkdtempSync(join(tmpdir(), "study-result-test-"));
  db = createClient({ url: `file:${join(fixtureDirectory, "fixture.sqlite")}` });
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE user(id TEXT PRIMARY KEY, role TEXT, abarca_user_id INTEGER, super_id TEXT);
    INSERT INTO user VALUES ('owner','2',100,NULL), ('admin','admin',200,NULL), ('office','1',300,NULL), ('other','2',400,NULL), ('child','2',500,'owner');
    CREATE TABLE organization(abarca_user_id INTEGER);
    INSERT INTO organization VALUES (999);
    CREATE TABLE comparativas(id TEXT PRIMARY KEY, user_id TEXT, status TEXT, plan TEXT,
      comision_fijo REAL, comision_indexado REAL, comision_sales_person_fijo REAL, comision_sales_person_indexado REAL);
    INSERT INTO comparativas VALUES ('c','owner','processing','["fijo"]',NULL,NULL,NULL,NULL);
    ALTER TABLE comparativas ADD COLUMN company_id TEXT;
    CREATE TABLE comercializadoras(id TEXT PRIMARY KEY, name TEXT);
    INSERT INTO comercializadoras VALUES ('supplier','NATURGY');
    CREATE TABLE user_company_commissions(id TEXT PRIMARY KEY, user_id TEXT, comercializadora_id TEXT, commission_type TEXT, commission_value REAL);
    CREATE TABLE default_company_commissions(id TEXT PRIMARY KEY, comercializadora_id TEXT, commission_type TEXT, commission_value REAL);
    CREATE TABLE role_permission_settings(role TEXT, permission_key TEXT, enabled INTEGER);
    INSERT INTO role_permission_settings VALUES ('2','comparisons.study.review',1);
    CREATE TABLE user_permission_overrides(user_id TEXT, permission_key TEXT, enabled INTEGER);
    CREATE TABLE comparativa_changes(id TEXT PRIMARY KEY, comparativa_id TEXT, user_id TEXT, change_type TEXT, field_name TEXT, old_value TEXT, new_value TEXT, description TEXT, created_at TEXT);
  `);
  await db.executeMultiple(migration);
});
afterEach(() => { db.close(); rmSync(fixtureDirectory, { recursive: true }); });

async function write<T>(run: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await db.transaction("write");
  try { const output = await run(tx); await tx.commit(); return output; }
  catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}
async function receive(overrides: Record<string, unknown> = {}) {
  const payload = AbarcaWebhookSchema.parse({ ide: 1, crm_id: 100, oferta_tipo: "fija", empresa: "NATURGY - POR USO LUZ", comision_oferta: 100, comision_base: 25, ...overrides });
  await write(async (tx) => {
    await receiveStudyResult(tx, "c", payload, JSON.stringify(payload));
    await tx.execute("UPDATE comparativas SET status = 'awaiting_review' WHERE id = 'c'");
  });
}
async function row() { return (await db.execute("SELECT * FROM comparativas WHERE id='c'")).rows[0]; }
async function stored() { return (await db.execute("SELECT * FROM comparison_study_results WHERE comparativa_id='c'")).rows[0]; }
async function auditRows() { return (await db.execute("SELECT * FROM comparativa_changes ORDER BY rowid")).rows; }
async function decision(override: Partial<StudyResultDecision> = {}, actor = "owner", plan?: StudyPlan) {
  const preview = (await getStudyResult(db, "c", actor, plan)).data!;
  return { resultId: preview.id, revision: preview.revision, planDecision: "none", commissionDecision: "apply", ...override } as StudyResultDecision;
}
const confirm = (input: StudyResultDecision, actor = "owner") => write((tx) => confirmStudyResult(tx, "c", actor, input));
async function conflict() { await db.execute("UPDATE comparativas SET comision_fijo=10, comision_sales_person_fijo=3 WHERE id='c'"); await receive(); }

describe("study receipt and server commissions", () => {
  test("migration is idempotent and has a unique comparison FK without historical backfill", async () => {
    await db.executeMultiple(migration);
    expect((await stored())).toBeUndefined();
    expect((await db.execute("PRAGMA foreign_key_list(comparison_study_results)")).rows[0].table).toBe("comparativas");
    await receive();
    await expect(db.execute("INSERT INTO comparison_study_results SELECT * FROM comparison_study_results")).rejects.toThrow();
  });
  test.each([undefined, null, "", "fixed", "FIJA", "fijo", 0, true, {}, []])("invalid type %j is accepted and pending", async (oferta_tipo) => {
    await receive({ oferta_tipo, comparativa_pdf: "arbitrary-document" });
    expect((await stored()).received_type).toBeNull();
    expect((await stored()).state).toBe("pending");
    expect((await row()).comision_fijo).toBeNull();
  });
  test.each(["fija", "indexada"])("valid type %s auto-applies only target and leaves awaiting_review", async (type) => {
    await db.execute(`UPDATE comparativas SET plan='["fijo","indexado"]'`);
    const target = type === "fija" ? "fijo" : "indexado";
    await receive({ oferta_tipo: type });
    expect((await row())[`comision_${target}`]).toBe(100);
    expect((await row())[`comision_sales_person_${target}`]).toBe(25);
    expect((await row()).status).toBe("awaiting_review");
    expect((await stored()).state).toBe("applied");
  });
  test.each([
    ["percent", 12.345, 12.35], ["fixed", 23.456, 23.46], ["percent", 0, 0], ["fixed", 0, 0],
  ])("owner override %s %s wins", async (kind, value, expected) => {
    await db.execute("INSERT INTO default_company_commissions VALUES ('d','supplier','fixed',999)");
    await db.execute({ sql: "INSERT INTO user_company_commissions VALUES ('u','owner','supplier',?,?)", args: [kind, value] });
    await receive();
    expect((await row()).comision_sales_person_fijo).toBe(expected);
    expect((await stored()).calculation_source).toBe("user_rule");
  });
  test.each([["percent", 35, 35], ["fixed", 15, 15], ["fixed", 0, 0]])("default %s applies", async (kind, value, expected) => {
    await db.execute({ sql: "INSERT INTO default_company_commissions VALUES ('d','supplier',?,?)", args: [kind, value] });
    await receive({ crm_id: 200 });
    expect((await row()).comision_sales_person_fijo).toBe(expected);
  });
  test.each([200, 300, 400, 999, 123456])("actor %s cannot use owner fallback", async (crm_id) => {
    await receive({ crm_id });
    expect((await row()).comision_fijo).toBe(100);
    expect((await row()).comision_sales_person_fijo).toBeNull();
  });
  test("shared or ambiguous individual identity cannot use fallback", async () => {
    await db.execute("UPDATE user SET abarca_user_id=100 WHERE id='other'");
    await receive();
    expect((await stored()).verified_author_id).toBeNull();
    expect((await row()).comision_sales_person_fijo).toBeNull();
  });
  test("organization identity wins even when equal to the owner", async () => {
    await db.execute("UPDATE organization SET abarca_user_id=100");
    await receive();
    expect((await row()).comision_sales_person_fijo).toBeNull();
  });
  test("explicit zero offer and base remain real assigned values", async () => {
    await receive({ comision_oferta: 0, comision_base: 0 });
    expect((await row()).comision_fijo).toBe(0);
    expect((await row()).comision_sales_person_fijo).toBe(0);
  });
  test.each([undefined, null])("missing offer %s never overwrites even with fixed rule and conflicts", async (comision_oferta) => {
    await db.execute("UPDATE comparativas SET comision_fijo=80, comision_sales_person_fijo=90");
    await db.execute("INSERT INTO default_company_commissions VALUES ('d','supplier','fixed',777)");
    await receive({ comision_oferta });
    expect((await stored()).state).toBe("resolved");
    expect((await row()).comision_fijo).toBe(80);
    expect((await row()).comision_sales_person_fijo).toBe(90);
    expect((await auditRows()).some((entry) => String(entry.field_name).startsWith("comision_"))).toBe(false);
  });
  test.each(["missing", "NAT", "NATURGY EXTRA"])("unknown supplier %s does not become rule absence fallback", async (empresa) => {
    await receive({ empresa });
    expect((await row()).comision_sales_person_fijo).toBeNull();
  });
  test("ambiguous normalized suppliers do not select a first match", async () => {
    await db.execute("INSERT INTO comercializadoras VALUES ('duplicate',' naturgy ')");
    await receive();
    expect((await row()).comision_sales_person_fijo).toBeNull();
  });
  test("exact full supplier name takes precedence over prefix", async () => {
    await db.execute("INSERT INTO comercializadoras VALUES ('full','NATURGY - POR USO LUZ')");
    await db.execute("INSERT INTO default_company_commissions VALUES ('d','full','fixed',42)");
    await receive();
    expect((await row()).comision_sales_person_fijo).toBe(42);
  });
  test.each(["comision_fijo", "comision_sales_person_fijo"])("target %s=0 prevents autoapply", async (field) => {
    await db.execute(`UPDATE comparativas SET ${field}=0`);
    await receive();
    expect((await stored()).state).toBe("pending");
    expect((await row())[field]).toBe(0);
  });
  test("inactive plan amounts neither conflict nor change", async () => {
    await db.execute("UPDATE comparativas SET comision_indexado=400, comision_sales_person_indexado=200");
    await receive();
    expect((await stored()).state).toBe("applied");
    expect((await row()).comision_indexado).toBe(400);
    expect((await row()).comision_sales_person_indexado).toBe(200);
  });
  test("receipt duplicate is immutable even with a different payload", async () => {
    await receive();
    const saved = await stored();
    await receive({ comision_oferta: 999, oferta_tipo: "indexada" });
    expect(await stored()).toEqual(saved);
    expect((await row()).comision_fijo).toBe(100);
  });
  test("rule errors roll back receipt, commission and audits", async () => {
    await db.execute("DROP TABLE user_company_commissions");
    await expect(receive()).rejects.toThrow();
    expect(await stored()).toBeUndefined();
    expect((await row()).comision_fijo).toBeNull();
    expect(await auditRows()).toEqual([]);
  });
  test("nonfinite calculation fails instead of persisting", async () => {
    await db.execute("INSERT INTO default_company_commissions VALUES ('d','supplier','percent',1e308)");
    await expect(receive({ comision_oferta: 100 })).rejects.toThrow("Non-finite");
    expect(await stored()).toBeUndefined();
  });
  test.each(["fixed", "percent"])("decimal half-cent rounding for %s rules", async (kind) => {
    await db.execute({ sql: "INSERT INTO default_company_commissions VALUES ('d','supplier',?,1.005)", args: [kind] });
    await receive({ comision_oferta: 100 });
    expect((await row()).comision_sales_person_fijo).toBe(1.01);
  });
  test("offer and percentage fallback round half-cents", async () => {
    await receive({ comision_oferta: 1.005, comision_base: 100 });
    expect((await row()).comision_fijo).toBe(1.01);
    expect((await row()).comision_sales_person_fijo).toBe(1.01);
  });
  test("percentage arithmetic retains half-cent rounding despite binary noise", async () => {
    await receive({ comision_oferta: 0.29, comision_base: 50 });
    expect((await row()).comision_sales_person_fijo).toBe(0.15);
  });
  test.each([1, -1])("half-cents round away from zero for sign %s", async (sign) => {
    await receive({ comision_oferta: sign * 1.005, comision_base: 100 });
    expect((await row()).comision_fijo).toBe(sign * 1.01);
    expect((await row()).comision_sales_person_fijo).toBe(sign * 1.01);
  });
  test.each([1, -1])("percentage half-cent noise is corrected for sign %s", async (sign) => {
    await receive({ comision_oferta: sign * 0.29, comision_base: 50 });
    expect((await row()).comision_sales_person_fijo).toBe(sign * 0.15);
  });
  test.each([1e10, -1e10, 1e13, -1e13, Number.MAX_SAFE_INTEGER / 100, -Number.MAX_SAFE_INTEGER / 100])("large safe amount %s is never inflated by tolerance", async (value) => {
    await receive({ comision_oferta: value, comision_base: 100 });
    expect((await row()).comision_fijo).toBe(value);
    expect((await row()).comision_sales_person_fijo).toBe(value);
  });
  test.each([1e14, -1e14, 1e20, -1e20, Number.MAX_SAFE_INTEGER / 100 + 0.02, -Number.MAX_SAFE_INTEGER / 100 - 0.02])("out-of-range offer %s is rejected even for unknown-type receipt", async (value) => {
    await expect(receive({ oferta_tipo: null, comision_oferta: value })).rejects.toThrow("safe cent precision");
    expect(await stored()).toBeUndefined();
    expect((await row()).comision_fijo).toBeNull();
    expect(await auditRows()).toEqual([]);
  });
  test("out-of-range fixed commission rolls back receipt and financial writes", async () => {
    await db.execute("INSERT INTO default_company_commissions VALUES ('d','supplier','fixed',1e14)");
    await expect(receive()).rejects.toThrow("safe cent precision");
    expect(await stored()).toBeUndefined();
    expect((await row()).comision_fijo).toBeNull();
  });
  test("out-of-range finite percentage result is rejected", async () => {
    await expect(receive({ comision_oferta: 1e13, comision_base: 1000 })).rejects.toThrow("safe cent precision");
    expect(await stored()).toBeUndefined();
  });
  test.each([1e14, -1e14])("manual amount %s outside cent precision is a validation error", async (manualSales) => {
    await conflict();
    await expect(confirm(await decision({ commissionDecision: "manual", manualSales }, "admin"), "admin")).rejects.toMatchObject({ status: 400 });
    expect((await stored()).state).toBe("pending");
    expect((await row()).comision_sales_person_fijo).toBe(3);
  });
  test("historical completed studies never create a new result", async () => {
    await db.execute("UPDATE comparativas SET status='completed'");
    await expect(receive()).rejects.toMatchObject({ status: 409 });
    expect(await stored()).toBeUndefined();
  });
  test("autoapply audit failure rolls back result and both commissions", async () => {
    await db.execute(`CREATE TRIGGER fail_auto BEFORE INSERT ON comparativa_changes
      WHEN NEW.field_name='study_result_resolution' BEGIN SELECT RAISE(ABORT, 'audit failure'); END`);
    await expect(receive()).rejects.toThrow("audit failure");
    expect(await stored()).toBeUndefined();
    expect((await row()).comision_fijo).toBeNull();
    expect((await row()).comision_sales_person_fijo).toBeNull();
    expect(await auditRows()).toEqual([]);
  });
  test("corrupt negative rules fail; negative fallback is unavailable", async () => {
    await db.execute("INSERT INTO default_company_commissions VALUES ('d','supplier','fixed',-1)");
    await expect(receive()).rejects.toThrow("Invalid commission configuration");
    await db.execute("DELETE FROM default_company_commissions");
    await receive({ comision_base: -1 });
    expect((await row()).comision_sales_person_fijo).toBeNull();
  });
  test.each([" ", "0x10"])("corrupt persisted monetary text %j is not coerced into an amount", async (value) => {
    await db.execute({ sql: "UPDATE comparativas SET comision_fijo=?", args: [value] });
    await expect(receive()).rejects.toThrow("Invalid persisted monetary value");
    expect(await stored()).toBeUndefined();
  });
});

describe("preview and confirmation", () => {
  test("GET without a result is read-only and returns null", async () => {
    expect(await getStudyResult(db, "c", "owner")).toMatchObject({ data: null, comparisonStatus: "processing" });
    expect(await auditRows()).toEqual([]);
  });
  test("unknown type requires selected-plan revision; preview never writes", async () => {
    await receive({ oferta_tipo: "invalid" });
    const noPlan = await decision();
    const snapshot = await stored();
    const preview = await decision({ chosenType: "fijo" }, "owner", "fijo");
    expect(await stored()).toEqual(snapshot);
    expect(preview.revision).not.toBe(noPlan.revision);
    await expect(confirm({ ...preview, revision: noPlan.revision })).rejects.toMatchObject({ status: 409 });
    await confirm(preview);
    expect((await stored()).type_origin).toBe("user");
    expect((await row()).comision_fijo).toBe(100);
  });
  test.each(["add", "replace"] as const)("plan %s preserves inactive stored amounts", async (planDecision) => {
    await db.execute("UPDATE comparativas SET comision_fijo=88, comision_sales_person_fijo=44");
    await receive({ oferta_tipo: "indexada" });
    await confirm(await decision({ planDecision }));
    expect(JSON.parse(String((await row()).plan))).toEqual(planDecision === "add" ? ["fijo", "indexado"] : ["indexado"]);
    expect((await row()).comision_fijo).toBe(88);
    expect((await row()).comision_sales_person_fijo).toBe(44);
    expect((await row()).comision_indexado).toBe(100);
  });
  test.each(["keep", "apply"] as const)("calculable decision %s", async (commissionDecision) => {
    await conflict();
    await confirm(await decision({ commissionDecision }));
    expect((await row()).comision_fijo).toBe(commissionDecision === "keep" ? 10 : 100);
    expect((await row()).comision_sales_person_fijo).toBe(commissionDecision === "keep" ? 3 : 25);
  });
  test.each(["offer_keep_sales", "offer_clear_sales"] as const)("uncalculable decision %s", async (commissionDecision) => {
    await db.execute("UPDATE comparativas SET comision_fijo=10, comision_sales_person_fijo=3");
    await receive({ empresa: "unknown" });
    await confirm(await decision({ commissionDecision }));
    expect((await row()).comision_fijo).toBe(100);
    expect((await row()).comision_sales_person_fijo).toBe(commissionDecision === "offer_keep_sales" ? 3 : null);
    if (commissionDecision === "offer_clear_sales") expect(await auditRows()).toEqual(expect.arrayContaining([expect.objectContaining({ field_name: "comision_sales_person_fijo", old_value: "3", new_value: null })]));
  });
  test.each(["admin", "office"])("%s may set manual sales zero", async (actor) => {
    await conflict();
    await confirm(await decision({ commissionDecision: "manual", manualSales: 0 }, actor), actor);
    expect((await row()).comision_sales_person_fijo).toBe(0);
    expect((await row()).comision_fijo).toBe(100);
  });
  test("role2 cannot set manual sales or submit raw financial fields", async () => {
    await conflict();
    await expect(confirm(await decision({ commissionDecision: "manual", manualSales: 0 }))).rejects.toMatchObject({ status: 403 });
    for (const extra of [{ offer: 1 }, { base: 1 }, { user_id: "admin" }, { manualSales: 3 }]) {
      expect(StudyResultDecisionSchema.safeParse({ ...await decision(), ...extra }).success).toBe(false);
    }
  });
  test("received type may not be overridden even with same selected type", async () => {
    await conflict();
    await expect(confirm(await decision({ chosenType: "fijo" }))).rejects.toMatchObject({ status: 400 });
    await expect(getStudyResult(db, "c", "owner", "indexado")).rejects.toMatchObject({ status: 400 });
  });
  test("missing offer + missing type + plan replacement preserves all commissions", async () => {
    await db.execute("UPDATE comparativas SET comision_fijo=88, comision_sales_person_fijo=44, comision_indexado=66, comision_sales_person_indexado=33");
    await receive({ oferta_tipo: null, comision_oferta: null });
    await confirm(await decision({ chosenType: "indexado", planDecision: "replace", commissionDecision: "keep" }, "owner", "indexado"));
    expect(await row()).toMatchObject({ comision_fijo: 88, comision_sales_person_fijo: 44, comision_indexado: 66, comision_sales_person_indexado: 33 });
    expect((await auditRows()).some((entry) => String(entry.field_name).startsWith("comision_"))).toBe(false);
  });
  test("missing offer forbids fixed/apply/manual amount mutations", async () => {
    await receive({ oferta_tipo: null, comision_oferta: null });
    await expect(confirm(await decision({ chosenType: "fijo" }, "owner", "fijo"))).rejects.toMatchObject({ status: 403 });
    await expect(confirm(await decision({ chosenType: "fijo", commissionDecision: "manual", manualSales: 10 }, "admin", "fijo"), "admin")).rejects.toMatchObject({ status: 403 });
  });
  test("missing offer needs no financial rule/supplier lookup even for type and plan decisions", async () => {
    await receive({ oferta_tipo: null, comision_oferta: null });
    await db.execute("DROP TABLE user_company_commissions");
    await db.execute("DROP TABLE comercializadoras");
    const input = await decision({ chosenType: "indexado", planDecision: "add", commissionDecision: "keep" }, "owner", "indexado");
    await confirm(input);
    expect((await row()).comision_indexado).toBeNull();
  });
  test("pending steps distinguish type/plan selection from a real target amount conflict", async () => {
    await receive({ oferta_tipo: null });
    expect((await getStudyResult(db, "c", "owner")).data?.pendingSteps).toEqual(["type"]);
    expect((await getStudyResult(db, "c", "owner", "fijo")).data?.pendingSteps).toEqual([]);
    expect((await getStudyResult(db, "c", "owner", "indexado")).data?.pendingSteps).toEqual(["plan"]);
    await db.execute("UPDATE comparativas SET comision_fijo=0");
    expect((await getStudyResult(db, "c", "owner", "fijo")).data?.pendingSteps).toEqual(["commissions"]);
  });
  test.each([
    "UPDATE comparativas SET user_id='other'",
    `UPDATE comparativas SET plan='["fijo","indexado"]'`,
    "UPDATE comparativas SET comision_fijo=11",
    "UPDATE comparativas SET comision_sales_person_indexado=0",
    "UPDATE comparativas SET company_id='changed'",
    "INSERT INTO default_company_commissions VALUES ('d','supplier','fixed',77)",
    "UPDATE user SET abarca_user_id=101 WHERE id='owner'",
    "UPDATE user SET role='1' WHERE id='owner'",
    "UPDATE organization SET abarca_user_id=100",
    "UPDATE comercializadoras SET name='unknown'",
  ])("proposal becomes stale after %s", async (sql) => {
    await conflict();
    const input = await decision({}, "admin");
    await db.execute(sql);
    await expect(confirm(input, "admin")).rejects.toMatchObject({ status: 409 });
    expect((await stored()).state).toBe("pending");
  });
  test("fallback proof cannot be upgraded after receipt or reused after owner changes", async () => {
    await conflict();
    await db.execute("UPDATE comparativas SET user_id='other'");
    await db.execute("UPDATE user SET abarca_user_id=NULL WHERE id='owner'");
    await db.execute("UPDATE user SET abarca_user_id=100 WHERE id='other'");
    const preview = await getStudyResult(db, "c", "admin");
    expect(preview.data?.salesCalculable).toBe(false);
    await confirm(await decision({ commissionDecision: "offer_keep_sales" }, "admin"), "admin");
    expect((await row()).comision_sales_person_fijo).toBe(3);
  });
  test("role2 DTO contains no agency, percentage, rule, raw payload or revision salt", async () => {
    await conflict();
    const dto = (await getStudyResult(db, "c", "owner")).data!;
    expect(dto.current).toEqual({ sales: 3 });
    expect(dto.proposed).toEqual({ sales: 25 });
    expect(dto.hasExistingCommissions).toBe(true);
    const admin = (await getStudyResult(db, "c", "admin")).data!;
    expect(admin.current).toEqual({ agency: 10, sales: 3 });
    const confirmed = await confirm(await decision());
    const serialized = JSON.stringify(confirmed);
    for (const term of ["agency", "percentage", "offer_euros", "commission_value", "raw_payload", "revision_salt", "base_percentage"]) expect(serialized).not.toContain(term);
    expect(confirmed.data?.resolution?.amounts).toEqual({ sales: 25 });
    expect(dto.revision).toMatch(/^[a-f0-9]{64}$/);
  });
  test("exact retry succeeds before recalculating rules; competing decisions fail", async () => {
    await conflict();
    const input = await decision({ commissionDecision: "keep" });
    const first = await confirm(input);
    const auditCount = (await auditRows()).length;
    await db.execute("DROP TABLE default_company_commissions");
    expect(await confirm(input)).toEqual(first);
    expect((await auditRows()).length).toBe(auditCount);
    await expect(confirm({ ...input, commissionDecision: "apply" })).rejects.toMatchObject({ status: 409 });
    await expect(confirm(input, "admin")).rejects.toMatchObject({ status: 409 });
    expect((await getStudyResult(db, "c", "owner")).data?.resolution?.amounts).toEqual({ sales: 3 });
  });
  test("second competing confirmation cannot overwrite the winner", async () => {
    await conflict();
    const first = await decision();
    const second = { ...first, commissionDecision: "keep" as const };
    await confirm(first);
    await expect(confirm(second)).rejects.toMatchObject({ status: 409 });
    expect((await row()).comision_fijo).toBe(100);
    expect((await row()).comision_sales_person_fijo).toBe(25);
  });
  test("changing existing rule values invalidates revision", async () => {
    await conflict();
    await db.execute("INSERT INTO user_company_commissions VALUES ('u','owner','supplier','percent',10)");
    const input = await decision();
    await db.execute("UPDATE user_company_commissions SET commission_value=0");
    await expect(confirm(input)).rejects.toMatchObject({ status: 409 });
  });
  test("audit failure rolls back plan, amounts and result resolution", async () => {
    await receive({ oferta_tipo: "indexada" });
    const input = await decision({ planDecision: "replace" });
    await db.execute(`CREATE TRIGGER fail_audit BEFORE INSERT ON comparativa_changes WHEN NEW.field_name = 'study_result_resolution'
      BEGIN SELECT RAISE(ABORT, 'audit failure'); END`);
    await expect(confirm(input)).rejects.toThrow("audit failure");
    expect((await row()).plan).toBe('["fijo"]');
    expect((await row()).comision_indexado).toBeNull();
    expect((await stored()).state).toBe("pending");
    expect(await auditRows()).toEqual([]);
  });
  test("result failure rolls back amounts and audits", async () => {
    await conflict();
    const input = await decision();
    await db.execute(`CREATE TRIGGER fail_result BEFORE UPDATE ON comparison_study_results BEGIN SELECT RAISE(ABORT, 'result failure'); END`);
    await expect(confirm(input)).rejects.toThrow("result failure");
    expect((await row()).comision_fijo).toBe(10);
    expect(await auditRows()).toEqual([]);
  });
});

describe("authorization revalidation", () => {
  test("own/subordinate visibility only for role2; admin/office can view all", async () => {
    await receive({ oferta_tipo: null });
    await expect(getStudyResult(db, "c", "other")).rejects.toMatchObject({ status: 403 });
    await db.execute("UPDATE comparativas SET user_id='child'");
    expect((await getStudyResult(db, "c", "owner")).data).not.toBeNull();
    expect((await getStudyResult(db, "c", "office")).data).not.toBeNull();
    expect((await getStudyResult(db, "c", "admin")).data).not.toBeNull();
  });
  test("permission denial precedes financial lookups", async () => {
    await db.execute("UPDATE role_permission_settings SET enabled=0");
    await db.execute("DROP TABLE comparison_study_results");
    await expect(getStudyResult(db, "c", "owner")).rejects.toMatchObject({ status: 403 });
  });
  test.each(["role", "permission", "ownership"])("revoked %s prevents confirmation", async (kind) => {
    await conflict();
    const input = await decision();
    await db.execute(kind === "role" ? "UPDATE user SET role='3' WHERE id='owner'" : kind === "permission" ? "UPDATE role_permission_settings SET enabled=0" : "UPDATE comparativas SET user_id='other'");
    await expect(confirm(input)).rejects.toMatchObject({ status: 403 });
    expect((await stored()).state).toBe("pending");
  });
  test("either review or complete permission suffices", async () => {
    await receive({ oferta_tipo: null });
    await db.execute("UPDATE role_permission_settings SET permission_key='comparisons.study.complete'");
    expect((await getStudyResult(db, "c", "owner")).data).not.toBeNull();
  });
  test.each(["completed", "processed", "rejected", "pending"])("status %s cannot receive pending decisions", async (status) => {
    await conflict();
    const input = await decision();
    await db.execute({ sql: "UPDATE comparativas SET status=?", args: [status] });
    await expect(confirm(input)).rejects.toMatchObject({ status: 409 });
  });
});
