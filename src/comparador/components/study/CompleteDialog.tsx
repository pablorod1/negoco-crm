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

/** Lo que se sabe del cliente antes de preguntar: el nombre de la comparativa y dónde está el suministro (SIPS). */
export function initialClient(clientName: string | null, study: StudyView): ClientForm {
  const location = study.supply?.location ?? null;
  return {
    name: clientName ?? "",
    lastName: "",
    kind: "Particular",
    documentNumber: "",
    email: "",
    phone: "",
    iban: "",
    address: "",
    postalCode: location?.postalCode ?? "",
    city: location?.municipality ?? "",
    province: location?.province ?? "",
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
 * Completar el estudio en dos pasos: con qué propuesta se queda el cliente y,
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
  onComplete: (proposalId: string, client: StudyClientDataInput | null) => Promise<void>;
}) {
  const [step, setStep] = useState<"proposal" | "client">("proposal");
  const [selected, setSelected] = useState(proposals.at(-1)?.id ?? "");
  const [client, setClient] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = proposals.find(({ id }) => id === selected);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onComplete(selected, clientPayload(client));
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
          <DialogTitle>{step === "proposal" ? "¿Qué propuesta acepta el cliente?" : "Datos del cliente"}</DialogTitle>
          <DialogDescription>
            {step === "proposal"
              ? "Su PDF se guarda en los documentos y la comparativa pasa a «Pendiente de revisión» con esa comercializadora y su comisión."
              : "Opcionales: rellenan el trámite al convertir la comparativa. Lo que falte se pide entonces."}
          </DialogDescription>
        </DialogHeader>

        {step === "proposal" ? (
          <div className="space-y-2" role="radiogroup" aria-label="Propuestas">
            {proposals.map((proposal) => (
              <label
                key={proposal.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
              >
                <input
                  type="radio"
                  name="final-proposal"
                  className="accent-primary"
                  checked={selected === proposal.id}
                  onChange={() => setSelected(proposal.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">
                    {proposal.comercializadoraName}
                    <span className="font-normal text-muted-foreground"> · Propuesta {proposal.number}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{proposal.productName}</span>
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
            {chosen && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Propuesta {chosen.number}: <span className="font-medium text-gray-900">{chosen.comercializadoraName}</span>{" "}
                · {chosen.productName}
              </p>
            )}
            <ClientFields form={client} onChange={setClient} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <DialogFooter>
          {step === "proposal" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!selected} onClick={() => setStep("client")}>
                Siguiente
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={saving} onClick={() => setStep("proposal")}>
                Atrás
              </Button>
              <Button disabled={saving || !selected} onClick={submit}>
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
