"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ACCEPTED_RULE, acceptedProposalsError } from "@/comparador/study/accepted";
import type { StudyClientDataInput } from "@/comparador/study/client-data";
import { euros, type ProposalView, type StudyView } from "./api";

export type ClientForm = Record<keyof StudyClientDataInput, string>;

const CLIENT_FIELDS: { key: keyof StudyClientDataInput; label: string; wide?: boolean; placeholder?: string }[] = [
  { key: "name", label: "Nombre o razón social" },
  { key: "lastName", label: "Apellidos" },
  { key: "documentNumber", label: "DNI o CIF" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo", wide: true },
  { key: "iban", label: "IBAN", wide: true, placeholder: "ES00 0000 0000 0000 0000 0000" },
  { key: "address", label: "Dirección del suministro", wide: true },
  { key: "postalCode", label: "Código postal" },
  { key: "city", label: "Población" },
  { key: "province", label: "Provincia" },
];

/**
 * Lo que se sabe del cliente antes de preguntar: lo leído de la factura, el
 * nombre de la comparativa y dónde está el suministro (SIPS).
 */
export function initialClient(clientName: string | null, study: StudyView): ClientForm {
  const location = study.supply?.location ?? null;
  const known = study.client;
  return {
    name: known?.name ?? clientName ?? "",
    lastName: known?.lastName ?? "",
    kind: known?.kind ?? "Particular",
    documentNumber: known?.documentNumber ?? "",
    email: known?.email ?? "",
    phone: known?.phone ?? "",
    iban: known?.iban ?? "",
    address: known?.address ?? "",
    postalCode: known?.postalCode ?? location?.postalCode ?? "",
    city: known?.city ?? location?.municipality ?? "",
    province: known?.province ?? location?.province ?? "",
  };
}

/** Solo se envía lo que se ha escrito. */
function clientPayload(form: ClientForm): StudyClientDataInput | null {
  const entries = Object.entries(form).filter(([key, value]) => key !== "kind" && value.trim());
  if (entries.length === 0) return null;
  return { ...Object.fromEntries(entries), kind: form.kind === "Empresa" ? "Empresa" : "Particular" };
}

/** Datos del cliente, todos opcionales: rellenan el trámite al convertir la comparativa. */
function ClientFields({ form, onChange }: { form: ClientForm; onChange: (form: ClientForm) => void }) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Tipo de cliente" className="inline-flex rounded-lg bg-gray-100 p-0.5">
        {(["Particular", "Empresa"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={form.kind === kind}
            onClick={() => onChange({ ...form, kind })}
            className={`rounded-md px-3 py-1 text-sm ${
              form.kind === kind ? "bg-white font-medium text-gray-900 shadow-sm" : "text-gray-600"
            }`}
          >
            {kind}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {CLIENT_FIELDS.map(({ key, label, wide, placeholder }) => (
          <div key={key} className={`space-y-1 ${wide ? "col-span-2" : ""}`}>
            <Label htmlFor={`client-${key}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`client-${key}`}
              className="h-8"
              placeholder={placeholder}
              value={form[key]}
              onChange={(event) => onChange({ ...form, [key]: event.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Completar el estudio en dos pasos: qué propuestas acepta el cliente (una
 * fija, una indexada, una de cada o de 2 a 3 fijas; una es la principal) y,
 * si se tienen, sus datos para el trámite.
 */
export function CompleteDialog({
  proposals,
  initial,
  open,
  onOpenChange,
  onComplete,
}: {
  proposals: ProposalView[];
  initial: ClientForm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (proposalIds: string[], client: StudyClientDataInput | null) => Promise<void>;
}) {
  const [step, setStep] = useState<"proposal" | "client">("proposal");
  // En el orden en que se marcan; la principal va aparte.
  const [selected, setSelected] = useState<string[]>(proposals.length ? [proposals.at(-1)!.id] : []);
  const [principal, setPrincipal] = useState<string | null>(proposals.at(-1)?.id ?? null);
  const [client, setClient] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const main = principal && selected.includes(principal) ? principal : (selected[0] ?? null);
  // La principal primero: su comercializadora es la de la comparativa.
  const ordered = main ? [main, ...selected.filter((id) => id !== main)] : [];
  const chosen = ordered.map((id) => proposals.find((proposal) => proposal.id === id)!).filter(Boolean);
  const invalid = selected.length > 0 ? acceptedProposalsError(chosen.map(({ pricing }) => pricing)) : null;

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onComplete(ordered, clientPayload(client));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido completar el estudio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <p className="text-xs font-medium text-muted-foreground">Paso {step === "proposal" ? 1 : 2} de 2</p>
          <DialogTitle>{step === "proposal" ? "¿Qué propuestas acepta el cliente?" : "Datos del cliente"}</DialogTitle>
          <DialogDescription>
            {step === "proposal"
              ? `${ACCEPTED_RULE} Sus PDFs se guardan en los documentos y la comparativa pasa a «Pendiente de revisión» con la comercializadora de la principal y la comisión de cada plan.`
              : "Lo leído de la factura y del SIPS ya está escrito: revísalo. Rellenan el trámite al convertir la comparativa; lo que falte se pide entonces."}
          </DialogDescription>
        </DialogHeader>

        {step === "proposal" ? (
          <div className="space-y-2" role="group" aria-label="Propuestas">
            {proposals.map((proposal) => (
              <label
                key={proposal.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selected.includes(proposal.id)}
                  onChange={() => toggle(proposal.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">
                    {proposal.comercializadoraName}
                    <span className="font-normal text-muted-foreground"> · Propuesta {proposal.number}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {proposal.pricing === "indexed" ? "Indexada" : "Fija"} · {proposal.productName}
                  </span>
                  {selected.length > 1 && selected.includes(proposal.id) && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        setPrincipal(proposal.id);
                      }}
                      className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        main === proposal.id ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {main === proposal.id ? "Principal" : "Hacer principal"}
                    </button>
                  )}
                </span>
                <span className="text-right">
                  <span className="block font-medium tabular-nums text-gray-900">{euros(proposal.annualTotal)}/año</span>
                  {proposal.savings !== null && (
                    <span
                      className={`block text-xs tabular-nums ${proposal.savings > 0 ? "text-success-700" : "text-danger"}`}
                    >
                      {proposal.savings > 0 ? `ahorra ${euros(proposal.savings)}` : `${euros(-proposal.savings)} más`}
                    </span>
                  )}
                </span>
                <a
                  href={proposal.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  aria-label={`Abrir el PDF de la propuesta ${proposal.number}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <ExternalLink className="size-4" />
                </a>
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {chosen.map((proposal, index) => (
                <li key={proposal.id}>
                  Propuesta {proposal.number}: <span className="font-medium text-gray-900">{proposal.comercializadoraName}</span> ·{" "}
                  {proposal.productName}
                  {chosen.length > 1 && index === 0 && <span className="text-primary"> · principal</span>}
                </li>
              ))}
            </ul>
            <ClientFields form={client} onChange={setClient} />
          </div>
        )}

        {(error ?? (step === "proposal" ? invalid : null)) && (
          <p role="alert" className="text-sm text-danger">
            {error ?? invalid}
          </p>
        )}
        <DialogFooter>
          {step === "proposal" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={selected.length === 0 || invalid !== null} onClick={() => setStep("client")}>
                Siguiente
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={saving} onClick={() => setStep("proposal")}>
                Atrás
              </Button>
              <Button disabled={saving || selected.length === 0 || invalid !== null} onClick={submit}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Completando…" : "Completar estudio"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
