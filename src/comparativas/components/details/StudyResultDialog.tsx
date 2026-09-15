"use client";

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import type { StudyCommissionDecision, StudyPlan, StudyResultDecision, StudyResultDTO } from "@/comparativas/types/study-result.types";
import type { useStudyResult } from "@/comparativas/hooks/useStudyResult";

export type StudyResultController = ReturnType<typeof useStudyResult>;
const money = (amount: number | null | undefined) => amount == null ? "Sin asignar" : `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(amount)} €`;
const planLabel = (plan: StudyPlan) => plan === "fijo" ? "Fijo" : "Indexado";
const decisionLabels: Record<StudyCommissionDecision, string> = {
  keep: "Mantener ambas comisiones actuales",
  apply: "Aplicar los importes propuestos",
  offer_keep_sales: "Aplicar la oferta y mantener la comisión comercial",
  offer_clear_sales: "Aplicar la oferta y dejar la comisión comercial sin asignar",
  manual: "Aplicar la oferta e introducir la comisión comercial",
};

export function StudyResultDialog({ controller, role }: { controller: StudyResultController; role: string }) {
  return (
    <Dialog open={controller.open} onOpenChange={(open) => { if (!open) controller.close(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" onInteractOutside={(event) => { if (controller.submitting) event.preventDefault(); }}>
        {controller.draft ? (
          <ReviewForm key={`${controller.draft.id}:${controller.draft.revision}:${controller.draft.targetPlan}`} result={controller.draft} controller={controller} role={role} />
        ) : (
          <DialogHeader>
            <DialogTitle>Revisar resultado del estudio</DialogTitle>
            <DialogDescription>{controller.loading ? "Cargando la propuesta…" : "Vuelve a cargar la propuesta para continuar."}</DialogDescription>
          </DialogHeader>
        )}
        {controller.error && <p role="alert" className="text-sm text-red-700">{controller.error}</p>}
        {!controller.draft && !controller.loading && <Button onClick={() => void controller.preview()}>Reintentar</Button>}
      </DialogContent>
    </Dialog>
  );
}

function ReviewForm({ result, controller, role }: { result: StudyResultDTO; controller: StudyResultController; role: string }) {
  const unknownType = result.receivedType === null;
  const target = result.targetPlan;
  const needsPlan = target !== null && !result.plans.includes(target);
  const needsCommissions = result.offerAvailable && (result.hasExistingCommissions || result.pendingSteps.includes("commissions"));
  const [step, setStep] = useState<"type" | "plan" | "commissions" | "confirm">(unknownType ? "type" : needsPlan ? "plan" : needsCommissions ? "commissions" : "confirm");
  const [planDecision, setPlanDecision] = useState<StudyResultDecision["planDecision"]>("none");
  const defaultDecision: StudyCommissionDecision = !result.offerAvailable ? "keep" : result.salesCalculable ? "apply" : "offer_clear_sales";
  const allowed = result.capabilities.commissionDecisions.filter((decision) => decision !== "manual" || ((role === "admin" || role === "1") && result.capabilities.canManualSales));
  const [commission, setCommission] = useState<StudyCommissionDecision | null>(needsCommissions ? null : allowed.includes(defaultDecision) ? defaultDecision : null);
  const [manual, setManual] = useState("");
  const manualValid = manual.trim() !== "" && Number.isFinite(Number(manual));
  const disabled = controller.loading || controller.submitting;
  const title = step === "type" ? "Selecciona el tipo de oferta" : step === "plan" ? "Selecciona cómo incluir el plan" : step === "commissions" ? "Revisa las comisiones" : "Confirma el resultado del estudio";
  const nextAfterPlan = () => setStep(needsCommissions ? "commissions" : "confirm");
  const confirm = () => {
    if (!target || !commission || !allowed.includes(commission) || (commission === "manual" && !manualValid)) return;
    void controller.submit({ resultId: result.id, revision: result.revision,
      ...(unknownType ? { chosenType: target } : {}), planDecision,
      commissionDecision: commission, ...(commission === "manual" ? { manualSales: Number(manual) } : {}),
    });
  };
  const choices = (name: string, values: { value: string; label: string; detail?: string }[], selected: string | null, change: (value: string) => void) => (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">{title}</legend>
      {values.map(({ value, label, detail }) => (
        <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 text-sm has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
          <input className="mt-1 accent-gray-900" type="radio" name={name} value={value} checked={selected === value} onChange={() => change(value)} />
          <span><span className="block font-medium">{label}</span>{detail && <span className="mt-1 block text-xs text-gray-600">{detail}</span>}</span>
        </label>
      ))}
    </fieldset>
  );
  return <>
    <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Revisa la propuesta del estudio con IA. Los cambios solo se guardan al confirmar.</DialogDescription></DialogHeader>
    {controller.changed && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">El resultado ha cambiado. Revisa de nuevo los importes y las decisiones antes de confirmar.</p>}
    {step === "type" && choices("study-type", [{ value: "fijo", label: "Fijo" }, { value: "indexado", label: "Indexado" }], target, (value) => void controller.preview(value as StudyPlan))}
    {step === "plan" && <>
      <p className="text-sm">El plan {target && planLabel(target)} no está incluido en la comparativa.</p>
      {choices("study-plan", [
        { value: "add", label: "Añadir el plan", detail: "Conservar los planes actuales y añadir el de la oferta." },
        { value: "replace", label: "Sustituir el plan actual", detail: "Los importes del plan sustituido permanecen guardados, aunque el plan quede inactivo." },
      ], planDecision, (value) => { setPlanDecision(value as "add" | "replace"); setCommission(needsCommissions ? null : defaultDecision); setManual(""); })}
    </>}
    {target && <>
      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="w-full text-left text-sm"><caption className="px-3 py-2 text-left font-medium text-gray-900">Comisiones del plan {planLabel(target)}</caption>
          <thead className="bg-gray-50 text-xs text-gray-600"><tr><th scope="col" className="p-3">Comisión</th><th scope="col" className="p-3">Actual</th><th scope="col" className="p-3">Propuesta</th></tr></thead>
          <tbody><tr><th scope="row" className="p-3 font-normal">Comercial</th><td className="p-3">{money(result.current?.sales)}</td><td className="p-3">{money(result.proposed?.sales)}</td></tr>
            {role !== "2" && result.current && "agency" in result.current && <tr><th scope="row" className="p-3 font-normal">Agencia</th><td className="p-3">{money(result.current.agency)}</td><td className="p-3">{money(result.proposed?.agency)}</td></tr>}
          </tbody>
        </table>
      </div>
      {!result.offerAvailable ? <p className="text-sm text-gray-600">No se ha recibido comisión de oferta. Ambas comisiones se mantienen sin cambios, incluso si cambias los planes.</p> : !result.salesCalculable ? <p className="text-sm text-amber-800">No se puede calcular la comisión comercial con las reglas disponibles. Elige cómo tratarla; no se ha calculado un importe nuevo.</p> : null}
    </>}
    {step === "commissions" && choices("study-commission", allowed.map((value) => ({ value, label: decisionLabels[value] })), commission, (value) => { setCommission(value as StudyCommissionDecision); setManual(""); })}
    {step === "commissions" && commission === "manual" && <label className="space-y-2 text-sm"><span>Comisión comercial manual (€)</span><Input type="number" step="any" value={manual} disabled={disabled} onChange={(event) => setManual(event.target.value)} /><span className="text-xs text-gray-500">Introduce un número; cero también es válido.</span></label>}
    {step === "confirm" && <div className="space-y-2 rounded-md bg-gray-50 p-3 text-sm">
      <p>Tipo de oferta: <strong>{target && planLabel(target)}</strong></p>
      <p>{planDecision === "none" ? "Se mantienen los planes incluidos." : planDecision === "add" ? "Se añadirá el plan de la oferta conservando los actuales." : "Se sustituirá el plan actual. Sus importes quedan guardados e inactivos."}</p>
      <p>{commission && decisionLabels[commission]}{commission === "manual" ? `: ${money(Number(manual))}` : "."}</p>
      <p>Las comisiones del otro plan no se modifican.</p>
      <p>Esta confirmación no completa el estudio; la revisión final se realiza después.</p>
    </div>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" disabled={controller.submitting} onClick={controller.close}>Cancelar</Button>
      {step === "confirm" && !needsCommissions && allowed.includes("manual") && <Button variant="outline" disabled={disabled} onClick={() => { setCommission(null); setStep("commissions"); }}>Modificar comisión</Button>}
      {step !== "type" && <Button variant="outline" disabled={disabled} onClick={() => void controller.preview(unknownType && target ? target : undefined)}>Volver y revisar</Button>}
      {step === "type" && <Button disabled={disabled || !target} onClick={() => needsPlan ? setStep("plan") : nextAfterPlan()}>Continuar</Button>}
      {step === "plan" && <Button disabled={disabled || planDecision === "none"} onClick={nextAfterPlan}>Continuar</Button>}
      {step === "commissions" && <Button disabled={disabled || !commission || (commission === "manual" && !manualValid)} onClick={() => setStep("confirm")}>Continuar</Button>}
      {step === "confirm" && <Button disabled={disabled || !commission || !target} onClick={confirm}>{controller.submitting ? "Guardando…" : "Confirmar resultado"}</Button>}
    </div>
  </>;
}
