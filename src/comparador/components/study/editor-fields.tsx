"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import type { InvoiceIssue } from "@/comparador/extraction/validate";
import { cn } from "@/core/utils";
import { euros } from "./api";

/** Campos del editor de la factura, comunes a la de luz y la de gas. */

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
export function Num({
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

export function Text({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg bg-white px-2 text-sm ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

export function Section({ title, hint, action, flagged, children }: { title: string; hint?: string; action?: ReactNode; flagged?: boolean; children: ReactNode }) {
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

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50">
      <Plus className="size-3.5" />
      {children}
    </button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-danger" aria-label="Quitar la línea">
      <Trash2 className="size-3.5" />
    </button>
  );
}

/** Lo que debería ser el importe (cantidad × precio), solo si no coincide con el escrito. */
export function Expected({ expected, amount }: { expected: number | null; amount: number }) {
  if (expected === null || Math.abs(Math.round(expected * 100) / 100 - amount) <= 0.011) return null;
  return <p className="mt-0.5 text-right text-[11px] tabular-nums text-danger">calc. {euros(expected)}</p>;
}

/** El campo o la línea tienen algún aviso de las cuentas. */
export const flaggedBy = (issues: readonly InvoiceIssue[], field: string) =>
  issues.some(({ field: issueField, severity }) => severity === "blocking" && (issueField === field || issueField.startsWith(`${field}.`) || issueField.startsWith(`${field}[`)));

/** Importe y descripción: descuentos, otros conceptos, servicios… */
export function AmountLines({
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

