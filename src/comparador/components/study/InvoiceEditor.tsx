"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import { issueMessages } from "@/comparador/extraction/issue-text";
import {
  electricitySubtotalOf,
  expectedTaxableBase,
  hasBlockingIssues,
  validateInvoice,
  type InvoiceIssue,
} from "@/comparador/extraction/validate";
import { Button } from "@/core/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/core/components/ui/dialog";
import { cn } from "@/core/utils";
import { euros, type ComparativaStudies } from "./api";

type Invoice = InvoiceExtraction;
type InvoiceFile = ComparativaStudies["invoices"][number];

const parse = (text: string) => {
  const value = Number(text.replace(/\s/g, "").replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) ? value : null;
};
const format = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value).replace(".", ",");

/**
 * Un número con coma decimal. Se guarda en cuanto lo escrito es un número.
 * Guarda su propio texto: las filas llevan una clave que cambia al añadir o
 * quitar líneas, para que ningún campo se quede con el texto de otra.
 */
function Num({
  value,
  onChange,
  invalid,
  className,
  label,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  invalid?: boolean;
  className?: string;
  label: string;
}) {
  const [text, setText] = useState(format(value));
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parse(event.target.value);
        if (parsed !== null || event.target.value.trim() === "") onChange(parsed);
      }}
      onBlur={() => setText(format(parse(text)))}
      className={cn(
        "h-8 w-full rounded-lg bg-white px-2 text-right text-sm tabular-nums ring-1 outline-none focus:ring-2 focus:ring-primary-500",
        invalid ? "ring-danger-300 bg-danger-50/40" : "ring-gray-200",
        className,
      )}
    />
  );
}

function Text({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg bg-white px-2 text-sm ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

function Section({ title, hint, action, flagged, children }: { title: string; hint?: string; action?: ReactNode; flagged?: boolean; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl p-4 ring-1", flagged ? "bg-danger-50/30 ring-danger-200" : "bg-white ring-gray-950/[0.06]")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            {flagged && <AlertTriangle className="size-3.5 text-danger" />}
            {title}
          </h3>
          {hint && <p className="text-xs text-gray-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50">
      <Plus className="size-3.5" />
      {children}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-danger" aria-label="Quitar la línea">
      <Trash2 className="size-3.5" />
    </button>
  );
}

/** Lo que debería ser el importe (cantidad × precio), solo si no coincide con el escrito. */
function Expected({ expected, amount }: { expected: number | null; amount: number }) {
  if (expected === null || Math.abs(Math.round(expected * 100) / 100 - amount) <= 0.011) return null;
  return <p className="mt-0.5 text-right text-[11px] tabular-nums text-danger">calc. {euros(expected)}</p>;
}

/** El campo o la línea tienen algún aviso de las cuentas. */
const flaggedBy = (issues: readonly InvoiceIssue[], field: string) =>
  issues.some(({ field: issueField, severity }) => severity === "blocking" && (issueField === field || issueField.startsWith(`${field}.`) || issueField.startsWith(`${field}[`)));

/** Importe y descripción: descuentos, otros conceptos, servicios… */
function AmountLines({
  lines,
  onChange,
  field,
  issues,
  placeholder,
}: {
  lines: { description: string; amount: number }[];
  onChange: (lines: { description: string; amount: number }[]) => void;
  field: string;
  issues: readonly InvoiceIssue[];
  placeholder: string;
}) {
  if (lines.length === 0) return <p className="text-xs text-gray-400">{placeholder}</p>;
  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={`${index}/${lines.length}`} className="grid grid-cols-[1fr_7rem_2rem] items-center gap-2">
          <Text label="Concepto" value={line.description} onChange={(description) => onChange(lines.map((item, at) => (at === index ? { ...item, description } : item)))} />
          <Num
            label="Importe"
            value={line.amount}
            invalid={flaggedBy(issues, `${field}[${index}]`)}
            onChange={(amount) => onChange(lines.map((item, at) => (at === index ? { ...item, amount: amount ?? 0 } : item)))}
          />
          <RemoveButton onClick={() => onChange(lines.filter((_, at) => at !== index))} />
        </div>
      ))}
    </div>
  );
}

/** Los datos de la factura, editables y validados mientras se escriben. */
function EditorForm({ invoice, setInvoice, issues }: { invoice: Invoice; setInvoice: (update: (invoice: Invoice) => Invoice) => void; issues: InvoiceIssue[] }) {
  const set = <K extends keyof Invoice>(key: K, value: Invoice[K]) => setInvoice((current) => ({ ...current, [key]: value }));
  const days = invoice.billingPeriod?.days ?? null;

  return (
    <div className="space-y-4">
      <Section title="Periodo y suministro" hint="Días facturados, potencia contratada y consumo del periodo." flagged={flaggedBy(issues, "billingPeriod") || flaggedBy(issues, "consumptionKwh") || flaggedBy(issues, "contractedKw")}>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-6">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-gray-500">Días facturados</span>
            <Num
              label="Días facturados"
              value={days}
              invalid={flaggedBy(issues, "billingPeriod")}
              onChange={(value) => set("billingPeriod", { from: invoice.billingPeriod?.from ?? null, to: invoice.billingPeriod?.to ?? null, days: Math.round(value ?? 0) })}
            />
          </label>
          {(["P1", "P2"] as const).map((period) => (
            <label key={period} className="space-y-1">
              <span className="text-gray-500">Potencia {period} (kW)</span>
              <Num label={`Potencia ${period}`} value={invoice.contractedKw[period]} invalid={flaggedBy(issues, `contractedKw.${period}`)} onChange={(value) => set("contractedKw", { ...invoice.contractedKw, [period]: value })} />
            </label>
          ))}
          <span className="hidden sm:block sm:col-span-2" />
          {(["P1", "P2", "P3"] as const).map((period) => (
            <label key={period} className="space-y-1 sm:col-span-2">
              <span className="text-gray-500">Consumo {period} (kWh)</span>
              <Num label={`Consumo ${period}`} value={invoice.consumptionKwh[period]} invalid={flaggedBy(issues, "consumptionKwh")} onChange={(value) => set("consumptionKwh", { ...invoice.consumptionKwh, [period]: value })} />
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="Término de potencia"
        hint="Una línea por periodo y tramo de fechas: kW × días × precio."
        flagged={flaggedBy(issues, "powerLines")}
        action={<AddButton onClick={() => set("powerLines", [...invoice.powerLines, { period: "P1", kw: invoice.contractedKw.P1 ?? 0, days: days ?? 0, pricePerKwDay: 0, amount: 0, originalPrice: null }])}>Línea</AddButton>}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[4.5rem_1fr_1fr_1.3fr_1.2fr_2rem] gap-2 text-[11px] text-gray-500">
            <span>Periodo</span><span className="text-right">kW</span><span className="text-right">Días</span><span className="text-right">€/kW día</span><span className="text-right">Importe</span><span />
          </div>
          {invoice.powerLines.map((line, index) => {
            const update = (patch: Partial<typeof line>) => set("powerLines", invoice.powerLines.map((item, at) => (at === index ? { ...item, ...patch } : item)));
            return (
              <div key={`${index}/${invoice.powerLines.length}`} className="grid grid-cols-[4.5rem_1fr_1fr_1.3fr_1.2fr_2rem] items-start gap-2">
                <select aria-label="Periodo" value={line.period} onChange={(event) => update({ period: event.target.value as "P1" | "P2" })} className="h-8 rounded-lg bg-white px-1.5 text-sm ring-1 ring-gray-200">
                  <option>P1</option>
                  <option>P2</option>
                </select>
                <Num label="kW" value={line.kw} onChange={(value) => update({ kw: value ?? 0 })} />
                <Num label="Días" value={line.days} onChange={(value) => update({ days: value ?? 0 })} />
                <Num label="Precio €/kW día" value={line.pricePerKwDay} onChange={(value) => update({ pricePerKwDay: value ?? 0 })} />
                <div>
                  <Num label="Importe" value={line.amount} invalid={flaggedBy(issues, `powerLines[${index}]`)} onChange={(value) => update({ amount: value ?? 0 })} />
                  <Expected expected={line.kw * line.days * line.pricePerKwDay} amount={line.amount} />
                </div>
                <RemoveButton onClick={() => set("powerLines", invoice.powerLines.filter((_, at) => at !== index))} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Término de energía"
        hint="Una línea por periodo (o «Todos» si hay un precio único): kWh × precio."
        flagged={flaggedBy(issues, "energyLines")}
        action={<AddButton onClick={() => set("energyLines", [...invoice.energyLines, { period: "P1", kwh: 0, pricePerKwh: 0, amount: 0 }])}>Línea</AddButton>}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[4.5rem_1fr_1.3fr_1.2fr_2rem] gap-2 text-[11px] text-gray-500">
            <span>Periodo</span><span className="text-right">kWh</span><span className="text-right">€/kWh</span><span className="text-right">Importe</span><span />
          </div>
          {invoice.energyLines.map((line, index) => {
            const update = (patch: Partial<typeof line>) => set("energyLines", invoice.energyLines.map((item, at) => (at === index ? { ...item, ...patch } : item)));
            return (
              <div key={`${index}/${invoice.energyLines.length}`} className="grid grid-cols-[4.5rem_1fr_1.3fr_1.2fr_2rem] items-start gap-2">
                <select aria-label="Periodo" value={line.period} onChange={(event) => update({ period: event.target.value as "P1" | "P2" | "P3" | "ALL" })} className="h-8 rounded-lg bg-white px-1.5 text-sm ring-1 ring-gray-200">
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                  <option value="ALL">Todos</option>
                </select>
                <Num label="kWh" value={line.kwh} onChange={(value) => update({ kwh: value ?? 0 })} />
                <Num label="Precio €/kWh" value={line.pricePerKwh} onChange={(value) => update({ pricePerKwh: value ?? 0 })} />
                <div>
                  <Num label="Importe" value={line.amount} invalid={flaggedBy(issues, `energyLines[${index}]`)} onChange={(value) => update({ amount: value ?? 0 })} />
                  <Expected expected={line.kwh * line.pricePerKwh} amount={line.amount} />
                </div>
                <RemoveButton onClick={() => set("energyLines", invoice.energyLines.filter((_, at) => at !== index))} />
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Descuentos sobre la energía" hint="En negativo." action={<AddButton onClick={() => set("energyDiscounts", [...invoice.energyDiscounts, { description: "Descuento", amount: 0 }])}>Descuento</AddButton>}>
          <AmountLines lines={invoice.energyDiscounts} onChange={(lines) => set("energyDiscounts", lines)} field="energyDiscounts" issues={issues} placeholder="Sin descuentos." />
        </Section>
        <Section title="Otros con impuesto eléctrico" hint="Excesos, reactiva, margen…" action={<AddButton onClick={() => set("otherElectricityLines", [...invoice.otherElectricityLines, { description: "Otro concepto", amount: 0 }])}>Concepto</AddButton>}>
          <AmountLines lines={invoice.otherElectricityLines} onChange={(lines) => set("otherElectricityLines", lines)} field="otherElectricityLines" issues={issues} placeholder="Ninguno." />
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="Bono social"
          flagged={flaggedBy(issues, "socialBonusLines")}
          action={<AddButton onClick={() => set("socialBonusLines", [...invoice.socialBonusLines, { days: days, pricePerDay: null, amount: 0 }])}>Línea</AddButton>}
        >
          <div className="space-y-2">
            {invoice.socialBonusLines.length > 0 && (
              <div className="grid grid-cols-[1fr_1.2fr_1.2fr_2rem] gap-2 text-[11px] text-gray-500">
                <span className="text-right">Días</span><span className="text-right">€/día</span><span className="text-right">Importe</span><span />
              </div>
            )}
            {invoice.socialBonusLines.map((line, index) => {
              const update = (patch: Partial<typeof line>) => set("socialBonusLines", invoice.socialBonusLines.map((item, at) => (at === index ? { ...item, ...patch } : item)));
              return (
                <div key={`${index}/${invoice.socialBonusLines.length}`} className="grid grid-cols-[1fr_1.2fr_1.2fr_2rem] items-center gap-2">
                  <Num label="Días" value={line.days} onChange={(value) => update({ days: value })} />
                  <Num label="€/día" value={line.pricePerDay} onChange={(value) => update({ pricePerDay: value })} />
                  <Num label="Importe" value={line.amount} invalid={flaggedBy(issues, `socialBonusLines[${index}]`)} onChange={(value) => update({ amount: value ?? 0 })} />
                  <RemoveButton onClick={() => set("socialBonusLines", invoice.socialBonusLines.filter((_, at) => at !== index))} />
                </div>
              );
            })}
          </div>
        </Section>
        <Section title="Alquiler del contador" flagged={flaggedBy(issues, "meterRental")}>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(
              [
                ["days", "Días"],
                ["pricePerDay", "€/día"],
                ["amount", "Importe"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-gray-500">{label}</span>
                <Num
                  label={`Contador: ${label}`}
                  value={invoice.meterRental?.[key] ?? null}
                  invalid={key === "amount" && flaggedBy(issues, "meterRental")}
                  onChange={(value) => set("meterRental", { days: invoice.meterRental?.days ?? null, pricePerDay: invoice.meterRental?.pricePerDay ?? null, amount: invoice.meterRental?.amount ?? 0, [key]: key === "amount" ? (value ?? 0) : value })}
                />
              </label>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Impuesto eléctrico" flagged={flaggedBy(issues, "electricityTax")}>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {(
            [
              ["base", "Base"],
              ["ratePercent", "Tipo (%)"],
              ["amount", "Importe"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-gray-500">{label}</span>
              <Num
                label={`Impuesto eléctrico: ${label}`}
                value={invoice.electricityTax?.[key] ?? null}
                invalid={flaggedBy(issues, `electricityTax.${key}`)}
                onChange={(value) => set("electricityTax", { base: invoice.electricityTax?.base ?? 0, ratePercent: invoice.electricityTax?.ratePercent ?? 5.11269632, amount: invoice.electricityTax?.amount ?? 0, [key]: value ?? 0 })}
              />
              {key === "base" && invoice.electricityTax && (
                // La base es la suma de potencia, energía, descuentos, otros y bono social.
                <Expected expected={electricitySubtotalOf(invoice)} amount={invoice.electricityTax.base} />
              )}
              {key === "amount" && invoice.electricityTax && (
                <Expected expected={(invoice.electricityTax.base * invoice.electricityTax.ratePercent) / 100} amount={invoice.electricityTax.amount} />
              )}
            </label>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Servicios y otros con IVA" hint="Packs, mantenimiento… (sin impuesto eléctrico)." action={<AddButton onClick={() => set("otherTaxableLines", [...invoice.otherTaxableLines, { description: "Servicio", amount: 0 }])}>Concepto</AddButton>}>
          <AmountLines lines={invoice.otherTaxableLines} onChange={(lines) => set("otherTaxableLines", lines)} field="otherTaxableLines" issues={issues} placeholder="Ninguno." />
        </Section>
        <Section title="Conceptos sin IVA" hint="Seguros y similares." action={<AddButton onClick={() => set("vatExemptLines", [...invoice.vatExemptLines, { description: "Concepto", amount: 0 }])}>Concepto</AddButton>}>
          <AmountLines lines={invoice.vatExemptLines} onChange={(lines) => set("vatExemptLines", lines)} field="vatExemptLines" issues={issues} placeholder="Ninguno." />
        </Section>
      </div>

      <Section title="IVA y total" flagged={flaggedBy(issues, "vat") || flaggedBy(issues, "total")}>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {(
            [
              ["base", "Base imponible"],
              ["ratePercent", "IVA (%)"],
              ["amount", "IVA"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-gray-500">{label}</span>
              <Num
                label={label}
                value={invoice.vat?.[key] ?? null}
                invalid={flaggedBy(issues, `vat.${key}`)}
                onChange={(value) => {
                  setInvoice((current) => ({
                    ...current,
                    vat: { base: current.vat?.base ?? 0, ratePercent: current.vat?.ratePercent ?? 21, amount: current.vat?.amount ?? 0, [key]: value ?? 0 },
                    ...(key === "base" ? { taxableBase: value } : {}),
                  }));
                }}
              />
              {key === "base" && invoice.vat && <Expected expected={expectedTaxableBase(invoice)} amount={invoice.vat.base} />}
              {key === "amount" && invoice.vat && <Expected expected={(invoice.vat.base * invoice.vat.ratePercent) / 100} amount={invoice.vat.amount} />}
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-gray-500">Total factura</span>
            <Num label="Total factura" value={invoice.total} invalid={flaggedBy(issues, "total")} onChange={(value) => set("total", value)} />
          </label>
        </div>
      </Section>
    </div>
  );
}

/** La factura junto al formulario: PDF o foto, tal como está en los documentos. */
function InvoiceViewer({ file }: { file: InvoiceFile | null }) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
        Esta factura no está en los documentos de la comparativa. Ábrela por otro lado para compararla.
      </div>
    );
  }
  return file.extension === "pdf" ? (
    <iframe title={`Factura ${file.filename}`} src={`${file.downloadUrl}#view=FitH`} className="h-full w-full border-0" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- Enlace firmado de Storage: no pasa por el optimizador.
    <img src={file.downloadUrl} alt={`Factura ${file.filename}`} className="h-full w-full object-contain" />
  );
}

/**
 * Revisar y corregir lo leído en la factura, como en Abarca: con la factura al
 * lado y las cuentas comprobándose al escribir. Si siguen sin cuadrar, se
 * puede guardar confirmando que son los datos de la factura.
 */
export function InvoiceEditor({
  open,
  onOpenChange,
  initial,
  file,
  required,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Invoice;
  file: InvoiceFile | null;
  /** La lectura no cuadra y aún no se ha revisado. */
  required: boolean;
  onSave: (invoice: Invoice, acceptMismatch: boolean) => Promise<void>;
}) {
  const [invoice, setInvoiceState] = useState(initial);
  const [version, setVersion] = useState(0);
  const [accept, setAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = useMemo(
    () => validateInvoice(invoice).filter(({ field }) => !/^(holder|cups|supplyAddress)/.test(field)),
    [invoice],
  );
  const blocking = hasBlockingIssues(issues);
  const messages = issueMessages(issues).filter(({ severity }) => severity === "blocking");

  const setInvoice = (update: (current: Invoice) => Invoice) => {
    setInvoiceState(update);
    setAccept(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(invoice, blocking && accept);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se han podido guardar los datos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
        <DialogHeader className="border-b border-gray-100 px-6 py-4">
          <DialogTitle>Revisar los datos de la factura</DialogTitle>
          <DialogDescription>
            {required
              ? "La lectura no cuadra: hasta revisarla no se calcula lo que paga hoy ni el ahorro. Compara con la factura y corrige lo que esté mal."
              : "Compara con la factura y corrige lo que esté mal. Lo que paga hoy y el ahorro se recalculan al guardar."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="hidden min-h-0 border-r border-gray-100 bg-gray-100 lg:block">
            <InvoiceViewer file={file} />
          </div>
          <div className="min-h-0 overflow-y-auto bg-gray-50/70 p-4 sm:p-6">
            <EditorForm key={version} invoice={invoice} setInvoice={setInvoice} issues={issues} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 text-sm">
            {blocking ? (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 font-medium text-danger">
                  <AlertTriangle className="size-4" />
                  {messages.length === 1 ? messages[0].message : `${messages.length} cuentas no cuadran`}
                </p>
                {messages.length > 1 && <p className="truncate text-xs text-gray-500">{messages.map(({ message }) => message).join(" · ")}</p>}
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="mt-0.5 accent-primary" checked={accept} onChange={(event) => setAccept(event.target.checked)} />
                  He comprobado que estos son los datos de la factura aunque las cuentas no cuadren.
                </label>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 font-medium text-success-700">
                <CheckCircle2 className="size-4" />
                Las cuentas cuadran.
              </p>
            )}
            {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setInvoiceState(initial);
                setVersion((value) => value + 1);
                setAccept(false);
              }}
            >
              <RotateCcw className="size-4" />
              Deshacer cambios
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || (blocking && !accept)} onClick={save}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar y recalcular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
