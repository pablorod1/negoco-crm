import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Client, InValue, Row } from "@libsql/client";
import { z } from "zod";
import { getEffectivePermissions } from "@/core/access-control/server";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import type { AbarcaWebhookPayload } from "@/comparativas/types/abarca.types";
import type {
  StudyCommissionDecision, StudyPlan, StudyResultAmounts,
  StudyResultDecision, StudyResultDTO, StudyResultResponse,
} from "@/comparativas/types/study-result.types";

type DB = Pick<Client, "execute">;
const PlanSchema = z.enum(["fijo", "indexado"]);
const PlansSchema = z.array(PlanSchema).min(1).max(2)
  .refine((plans) => new Set(plans).size === plans.length);
// Every rounded cent must remain a safe integer; never silently cap an amount.
const MAX_COMMISSION_EUROS = Number.MAX_SAFE_INTEGER / 100;
export const StudyResultDecisionSchema = z.strictObject({
  resultId: z.string().min(1).max(128),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  chosenType: PlanSchema.optional(),
  planDecision: z.enum(["none", "add", "replace"]),
  commissionDecision: z.enum(["keep", "apply", "offer_keep_sales", "offer_clear_sales", "manual"]),
  manualSales: z.number().finite().min(-MAX_COMMISSION_EUROS).max(MAX_COMMISSION_EUROS).optional(),
}).refine((input) => (input.commissionDecision === "manual") === (input.manualSales !== undefined));

export class StudyResultError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message); }
}
const conflict = () => new StudyResultError(409, "El estudio con IA ha cambiado. Vuelve a revisarlo.");
const nullableString = (value: unknown) => value == null ? null : String(value);
function money(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (!(["number", "string", "bigint"].includes(typeof value)) ||
    (typeof value === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))) {
    throw new Error("Invalid persisted monetary value");
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Non-finite monetary value");
  return amount;
}
function round(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Non-finite calculated commission");
  if (Math.abs(value) > MAX_COMMISSION_EUROS) throw new Error("Commission exceeds safe cent precision");
  // Decimal exponent shifting avoids 1.005 becoming 100.49999999999999.
  const [coefficient, exponent = "0"] = Math.abs(value).toString().split("e");
  const shifted = Number(`${coefficient}e${Number(exponent) + 2}`);
  // Correct binary noise only at a half-cent boundary. The absolute cap is
  // 1e-7 cents, so tolerance cannot grow into cents or perturb integer cents.
  const tolerance = Math.min(Number.EPSILON * shifted, 1e-7);
  const fraction = shifted - Math.floor(shifted);
  const cents = fraction < 0.5 && 0.5 - fraction <= tolerance
    ? Math.ceil(shifted)
    : Math.round(shifted);
  if (!Number.isSafeInteger(cents)) throw new Error("Commission exceeds safe cent precision");
  return Math.sign(value) * cents / 100;
}
export function normalizeReceivedStudyType(value: unknown): StudyPlan | null {
  return value === "fija" ? "fijo" : value === "indexada" ? "indexado" : null;
}
const fields = (plan: StudyPlan) => ({ agency: `comision_${plan}`, sales: `comision_sales_person_${plan}` });
function amounts(comparison: Row, plan: StudyPlan): StudyResultAmounts {
  const names = fields(plan);
  return { agency: money(comparison[names.agency]), sales: money(comparison[names.sales]) };
}
async function comparison(db: DB, id: string) {
  const { rows } = await db.execute({ sql: `SELECT id, user_id, company_id, status, plan,
    comision_fijo, comision_indexado, comision_sales_person_fijo, comision_sales_person_indexado
    FROM comparativas WHERE id = ?`, args: [id] });
  if (!rows[0]) throw new StudyResultError(404, "Comparador no encontrado");
  return rows[0];
}
const plansOf = (row: Row) => PlansSchema.parse(JSON.parse(String(row.plan)));
async function result(db: DB, id: string) {
  return (await db.execute({ sql: "SELECT * FROM comparison_study_results WHERE comparativa_id = ?", args: [id] })).rows[0];
}

/** Check visibility before querying result amounts, supplier rules or identities. */
export async function authorizeStudyResult(db: DB, comparisonId: string, userId: string) {
  const actor = (await db.execute({ sql: "SELECT id, role FROM user WHERE id = ?", args: [userId] })).rows[0];
  const role = String(actor?.role ?? "");
  if (!["admin", "1", "2"].includes(role)) throw new StudyResultError(403, "Sin acceso al estudio con IA");
  const permissions = await getEffectivePermissions(db, { id: userId, role });
  if (!permissions["comparisons.study.complete"] && !permissions["comparisons.study.review"]) {
    throw new StudyResultError(403, "Sin permiso para el estudio con IA");
  }
  const subject = (await db.execute({ sql: "SELECT user_id FROM comparativas WHERE id = ?", args: [comparisonId] })).rows[0];
  if (!subject) throw new StudyResultError(404, "Comparador no encontrado");
  if (role === "2" && String(subject.user_id) !== userId) {
    const subordinates = await getSubcomerciales(db, userId);
    if (!subordinates.ids.includes(String(subject.user_id))) throw new StudyResultError(403, "Sin acceso al comparador");
  }
  return role;
}

async function identity(db: DB, crmId: number) {
  const users = (await db.execute({ sql: "SELECT id, role, abarca_user_id FROM user WHERE abarca_user_id = ? ORDER BY id", args: [crmId] })).rows;
  const organizations = (await db.execute("SELECT abarca_user_id FROM organization ORDER BY abarca_user_id")).rows;
  const shared = organizations.some((org) => Number(org.abarca_user_id) === crmId);
  return { users, organizations, verifiedId: !shared && users.length === 1 ? String(users[0].id) : null };
}
function normalizeName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("es");
}
async function calculate(db: DB, subject: Row, stored: Row) {
  const offer = money(stored.offer_euros);
  // No financial proposal exists without an offer, even for a fixed rule.
  if (offer === null) return { sales: null, source: "no_offer", inputs: null };
  const suppliers = (await db.execute("SELECT id, name FROM comercializadoras ORDER BY id")).rows;
  const supplierName = normalizeName(String(stored.supplier_name ?? ""));
  const exact = suppliers.filter((supplier) => normalizeName(String(supplier.name)) === supplierName);
  const candidates = exact.length ? exact : suppliers.filter((supplier) =>
    normalizeName(String(supplier.name)) === supplierName.split(" - ")[0]);
  const supplier = supplierName && candidates.length === 1 ? candidates[0] : null;
  const owner = (await db.execute({ sql: "SELECT id, role, abarca_user_id FROM user WHERE id = ?", args: [subject.user_id] })).rows[0] ?? null;
  const proof = await identity(db, Number(stored.crm_id));
  let overrides: Row[] = [];
  let defaults: Row[] = [];
  if (supplier) {
    overrides = (await db.execute({ sql: `SELECT id, commission_type, commission_value FROM user_company_commissions
      WHERE user_id = ? AND comercializadora_id = ? ORDER BY id`, args: [subject.user_id, supplier.id] })).rows;
    defaults = (await db.execute({ sql: `SELECT id, commission_type, commission_value FROM default_company_commissions
      WHERE comercializadora_id = ? ORDER BY id`, args: [supplier.id] })).rows;
  }
  if (overrides.length > 1 || defaults.length > 1) throw new Error("Ambiguous commission configuration");
  const rule = overrides[0] ?? defaults[0];
  let sales: number | null = null;
  let source = "unavailable";
  if (supplier && offer !== null) {
    if (rule) {
      const value = money(rule.commission_value);
      if (value === null || value < 0 || !["fixed", "percent"].includes(String(rule.commission_type))) throw new Error("Invalid commission configuration");
      sales = round(rule.commission_type === "fixed" ? value : offer * value / 100);
      source = overrides.length ? "user_rule" : "default_rule";
    } else if (
      owner?.role === "2" && String(stored.receipt_owner_id) === String(subject.user_id) &&
      stored.verified_author_id === subject.user_id && proof.verifiedId === String(subject.user_id) &&
      money(stored.base_percentage) !== null && Number(stored.base_percentage) >= 0
    ) {
      sales = round(offer * Number(stored.base_percentage) / 100);
      source = "verified_base_percentage";
    }
  }
  return { sales, source, inputs: { suppliers, owner, proof, overrides, defaults } };
}

async function audit(db: DB, id: string, actor: string | null, field: string, oldValue: InValue, newValue: InValue) {
  await db.execute({ sql: `INSERT INTO comparativa_changes
    (id, comparativa_id, user_id, change_type, field_name, old_value, new_value, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [randomUUID(), id, actor,
    field.startsWith("comision_") ? "commission_update" : field === "plan" ? "plan_update" : "field_update",
    field, oldValue === null ? null : String(oldValue), newValue === null ? null : String(newValue),
    "Resultado del estudio con IA actualizado", new Date().toISOString()] });
}
async function writeAmounts(db: DB, subject: Row, plan: StudyPlan, next: StudyResultAmounts, actor: string | null) {
  const names = fields(plan);
  const previous = amounts(subject, plan);
  for (const key of ["agency", "sales"] as const) {
    const value = next[key] ?? null;
    if (previous[key] === value) continue;
    await db.execute({ sql: `UPDATE comparativas SET ${names[key]} = ? WHERE id = ?`, args: [value, subject.id] });
    await audit(db, String(subject.id), actor, names[key], previous[key] ?? null, value);
  }
}

/** Caller owns the webhook transaction; a failure rolls back documents and claim too. */
export async function receiveStudyResult(db: DB, comparisonId: string, payload: AbarcaWebhookPayload, rawPayload: string) {
  if (await result(db, comparisonId)) return;
  const subject = await comparison(db, comparisonId);
  if (!["pending", "processing"].includes(String(subject.status))) throw conflict();
  const proof = await identity(db, payload.crm_id);
  const received = normalizeReceivedStudyType(payload.oferta_tipo);
  const offer = payload.comision_oferta ?? null;
  // Also validate pending/unknown-type receipts before storing source amounts.
  if (offer !== null) round(offer);
  const id = randomUUID();
  await db.execute({ sql: `INSERT INTO comparison_study_results
    (id, comparativa_id, payload_hash, received_type, chosen_type, type_origin, offer_euros,
     base_percentage, supplier_name, crm_id, verified_author_id, receipt_owner_id, revision_salt, state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`, args: [id, comparisonId,
    createHash("sha256").update(rawPayload).digest("hex"), received, received, received ? "received" : null,
    payload.comision_oferta ?? null, payload.comision_base ?? null, payload.empresa ?? null,
    payload.crm_id, proof.verifiedId, subject.user_id, randomBytes(32).toString("hex")] });
  if (!received || !plansOf(subject).includes(received)) return;
  const current = amounts(subject, received);
  if (offer !== null && (current.agency !== null || current.sales !== null)) return;
  const calculation = offer === null ? { sales: null, source: "no_offer" } : await calculate(db, subject, (await result(db, comparisonId))!);
  const next = offer === null ? current : { agency: round(offer), sales: calculation.sales };
  if (offer !== null) await writeAmounts(db, subject, received, next, null);
  const state = offer === null ? "resolved" : "applied";
  await db.execute({ sql: `UPDATE comparison_study_results SET state = ?, resolved_at = ?,
    applied_values = ?, calculation_source = ?, resolution_request = ? WHERE id = ?`, args: [state,
    new Date().toISOString(), JSON.stringify(next), calculation.source,
    JSON.stringify({ planDecision: "none", commissionDecision: offer === null ? "keep" : "apply" }), id] });
  await audit(db, comparisonId, null, "study_result_resolution", "pending", state);
}

function filteredAmounts(value: StudyResultAmounts | null, role: string): StudyResultAmounts | null {
  return value === null ? null : role === "2" ? { sales: value.sales } : { sales: value.sales, agency: value.agency ?? null };
}
function decisions(offer: number | null, sales: number | null, role: string): StudyCommissionDecision[] {
  if (offer === null) return ["keep"];
  const choices: StudyCommissionDecision[] = sales === null ? ["keep", "offer_keep_sales", "offer_clear_sales"] : ["keep", "apply"];
  if (role !== "2") choices.push("manual");
  return choices;
}
async function proposal(db: DB, subject: Row, stored: Row, target: StudyPlan | null, role: string) {
  const calculation = await calculate(db, subject, stored);
  const revision = createHmac("sha256", String(stored.revision_salt)).update(JSON.stringify({
    subject, stored, target, role, calculation: calculation.inputs,
  })).digest("hex");
  return { calculation, revision };
}

function dto(subject: Row, stored: Row, role: string, target: StudyPlan | null, revision: string, sales: number | null): StudyResultDTO {
  const pending = stored.state === "pending";
  const offer = money(stored.offer_euros);
  const current = target ? amounts(subject, target) : null;
  const saved = stored.applied_values ? JSON.parse(String(stored.applied_values)) as StudyResultAmounts : null;
  const request = stored.resolution_request ? JSON.parse(String(stored.resolution_request)) as StudyResultDecision : null;
  const plans = plansOf(subject);
  const steps: StudyResultDTO["pendingSteps"] = [];
  if (pending) {
    if (!target) steps.push("type");
    else if (!plans.includes(target)) steps.push("plan");
    if (target && offer !== null && current && (current.agency !== null || current.sales !== null)) steps.push("commissions");
  }
  const canResolve = pending && subject.status === "awaiting_review";
  return {
    id: String(stored.id), state: stored.state as StudyResultDTO["state"],
    receivedType: stored.received_type as StudyPlan | null,
    chosenType: stored.chosen_type as StudyPlan | null,
    typeOrigin: stored.type_origin as StudyResultDTO["typeOrigin"], targetPlan: target, plans, revision,
    pendingSteps: steps,
    hasExistingCommissions: current !== null && (current.agency !== null || current.sales !== null),
    offerAvailable: offer !== null, salesCalculable: pending ? sales !== null : saved?.sales != null,
    current: filteredAmounts(pending ? current : saved, role),
    proposed: filteredAmounts(pending ? target && offer !== null ? { agency: round(offer), sales } : null : saved, role),
    capabilities: { canResolve, canChooseType: canResolve && stored.received_type === null,
      canManualSales: canResolve && role !== "2" && offer !== null,
      commissionDecisions: canResolve && target ? decisions(offer, sales, role) : [] },
    resolution: stored.resolved_at ? { actorId: nullableString(stored.resolution_actor_id),
      resolvedAt: String(stored.resolved_at), planDecision: request!.planDecision,
      commissionDecision: request!.commissionDecision, amounts: filteredAmounts(saved, role) } : null,
  };
}

export async function getStudyResult(db: DB, comparisonId: string, userId: string, previewPlan?: StudyPlan): Promise<StudyResultResponse> {
  const role = await authorizeStudyResult(db, comparisonId, userId);
  const subject = await comparison(db, comparisonId);
  const stored = await result(db, comparisonId);
  if (!stored) return { success: true, comparisonStatus: String(subject.status), data: null };
  if (previewPlan && stored.received_type && previewPlan !== stored.received_type) throw new StudyResultError(400, "El tipo recibido no se puede cambiar");
  const target = (stored.chosen_type ?? stored.received_type ?? previewPlan ?? null) as StudyPlan | null;
  const computed = stored.state === "pending" ? await proposal(db, subject, stored, target, role) : null;
  const revision = computed?.revision ?? String(stored.resolution_revision ?? createHmac("sha256", String(stored.revision_salt)).update(String(stored.id)).digest("hex"));
  return { success: true, comparisonStatus: String(subject.status), data: dto(subject, stored, role, target, revision, computed?.calculation.sales ?? null) };
}

/** Must run in a write transaction: authorization, revision, mutations and audit share a snapshot. */
export async function confirmStudyResult(db: DB, comparisonId: string, userId: string, input: StudyResultDecision): Promise<StudyResultResponse> {
  const parsed = StudyResultDecisionSchema.safeParse(input);
  if (!parsed.success) throw new StudyResultError(400, "Decisión del estudio con IA no válida");
  const decision = parsed.data;
  const role = await authorizeStudyResult(db, comparisonId, userId);
  const subject = await comparison(db, comparisonId);
  const stored = await result(db, comparisonId);
  if (!stored || stored.id !== decision.resultId) throw conflict();
  const request = JSON.stringify(decision);
  if (stored.state !== "pending") {
    if (stored.resolution_actor_id !== userId || stored.resolution_request !== request || stored.resolution_revision !== decision.revision) throw conflict();
    return { success: true, comparisonStatus: String(subject.status), data: dto(subject, stored, role, stored.chosen_type as StudyPlan, decision.revision, null) };
  }
  if (subject.status !== "awaiting_review") throw conflict();
  if (stored.received_type && decision.chosenType !== undefined) throw new StudyResultError(400, "El tipo recibido no se puede cambiar");
  const target = (stored.received_type ?? decision.chosenType) as StudyPlan | undefined;
  if (!target) throw new StudyResultError(400, "Selecciona el tipo del estudio con IA");
  const { calculation, revision } = await proposal(db, subject, stored, target, role);
  if (revision !== decision.revision) throw conflict();
  const plans = plansOf(subject);
  const included = plans.includes(target);
  if (included !== (decision.planDecision === "none")) throw new StudyResultError(400, "Revisa la decisión del plan");
  const offer = money(stored.offer_euros);
  if (!decisions(offer, calculation.sales, role).includes(decision.commissionDecision)) throw new StudyResultError(403, "Decisión de comisiones no permitida");
  const nextPlans = included ? plans : decision.planDecision === "add" ? [...plans, target] : [target];
  if (!included) {
    await db.execute({ sql: "UPDATE comparativas SET plan = ? WHERE id = ?", args: [JSON.stringify(nextPlans), comparisonId] });
    await audit(db, comparisonId, userId, "plan", JSON.stringify(plans), JSON.stringify(nextPlans));
  }
  const previous = amounts(subject, target);
  let next = previous;
  if (offer !== null && decision.commissionDecision !== "keep") {
    const sales = decision.commissionDecision === "manual" ? round(decision.manualSales!)
      : decision.commissionDecision === "offer_keep_sales" ? previous.sales
      : decision.commissionDecision === "offer_clear_sales" ? null : calculation.sales;
    next = { agency: round(offer), sales };
    await writeAmounts(db, subject, target, next, userId);
  }
  const source = offer === null ? "no_offer" : decision.commissionDecision === "apply" ? calculation.source : decision.commissionDecision;
  await db.execute({ sql: `UPDATE comparison_study_results SET state = 'resolved', chosen_type = ?, type_origin = ?,
    resolution_actor_id = ?, resolved_at = ?, resolution_request = ?, resolution_revision = ?, applied_values = ?, calculation_source = ?
    WHERE id = ? AND state = 'pending'`, args: [target, stored.received_type ? "received" : "user", userId,
    new Date().toISOString(), request, revision, JSON.stringify(next), source, stored.id] });
  if (!stored.received_type) await audit(db, comparisonId, userId, "study_result_type", null, target);
  await audit(db, comparisonId, userId, "study_result_resolution", "pending", "resolved");
  return { success: true, comparisonStatus: String(subject.status), data: dto(await comparison(db, comparisonId), (await result(db, comparisonId))!, role, target, revision, null) };
}
