"use client";

import { useState } from "react";
import { cn } from "@/core/utils";
import type { AncillarySimulation } from "@/comparador/study/ranking";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** «12,5» o «12.5» como €/MWh; null si está vacío o no vale. */
const parse = (text: string) => {
  const value = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(value) && value >= 0 && value <= 200 ? value : null;
};
const show = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value).replace(".", ","));

export interface AncillaryDraft {
  mode: "average" | "monthly";
  average: string;
  monthly: string[];
}

export function draftOf(value: AncillarySimulation | null): AncillaryDraft {
  return {
    mode: value?.monthlyPerMwh ? "monthly" : "average",
    average: show(value?.averagePerMwh),
    monthly: Array.from({ length: 12 }, (_, month) => show(value?.monthlyPerMwh?.[month])),
  };
}

/** El borrador como SSAA; null si no hay ningún valor. Un texto que no es número no cuenta. */
export function simulationOf(draft: AncillaryDraft): AncillarySimulation | null {
  if (draft.mode === "average") {
    const average = parse(draft.average);
    return average === null ? null : { averagePerMwh: average, monthlyPerMwh: null };
  }
  const monthly = draft.monthly.map(parse);
  return monthly.some((value) => value !== null) ? { averagePerMwh: null, monthlyPerMwh: monthly } : null;
}

/** Texto corto de unos SSAA: «12,5 €/MWh» o «por mes, media 11,8 €/MWh». */
export function describeAncillary(value: AncillarySimulation | null): string {
  if (!value) return "sin simular";
  if (value.monthlyPerMwh) {
    const filled = value.monthlyPerMwh.filter((item): item is number => item !== null);
    const mean = filled.reduce((sum, item) => sum + item, 0) / Math.max(1, filled.length);
    return `por mes, media ${mean.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/MWh`;
  }
  return `${(value.averagePerMwh ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/MWh`;
}

/**
 * Los servicios de ajuste de un año: una media para los 12 meses o el valor
 * de cada mes, en €/MWh. Un mes vacío toma la media de los demás.
 */
export function AncillaryEditor({ draft, onChange }: { draft: AncillaryDraft; onChange: (draft: AncillaryDraft) => void }) {
  const [focus, setFocus] = useState<number | null>(null);
  const invalid = (text: string) => text.trim() !== "" && parse(text) === null;

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Cómo se dan los SSAA" className="inline-flex rounded-xl bg-gray-100/80 p-1">
        {(
          [
            ["average", "Media de 12 meses"],
            ["monthly", "Valor por mes"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={draft.mode === mode}
            onClick={() => onChange({ ...draft, mode })}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm transition-all",
              draft.mode === mode ? "bg-white font-medium text-gray-900 shadow-sm ring-1 ring-gray-950/5" : "text-gray-500 hover:text-gray-900",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {draft.mode === "average" ? (
        <label className="block max-w-[220px] space-y-1.5">
          <span className="text-xs font-medium text-gray-700">SSAA de media</span>
          <span
            className={cn(
              "flex h-10 items-center rounded-xl bg-gray-100/80 px-3 ring-1 ring-transparent focus-within:bg-white focus-within:ring-primary-300",
              invalid(draft.average) && "ring-danger-300",
            )}
          >
            <input
              inputMode="decimal"
              autoFocus
              placeholder="Ej. 12,5"
              value={draft.average}
              onChange={(event) => onChange({ ...draft, average: event.target.value })}
              className="w-full bg-transparent text-sm font-medium tabular-nums text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
            />
            <span className="text-xs text-gray-400">€/MWh</span>
          </span>
        </label>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MONTHS.map((month, index) => (
            <label
              key={month}
              className={cn(
                "flex flex-col rounded-xl bg-gray-100/80 px-3 py-2 ring-1 ring-transparent transition-colors",
                focus === index && "bg-white ring-primary-300",
                invalid(draft.monthly[index]) && "ring-danger-300",
              )}
            >
              <span className="text-[11px] font-medium text-gray-500">{month}</span>
              <input
                inputMode="decimal"
                placeholder="—"
                value={draft.monthly[index]}
                onFocus={() => setFocus(index)}
                onBlur={() => setFocus(null)}
                onChange={(event) => {
                  const monthly = [...draft.monthly];
                  monthly[index] = event.target.value;
                  onChange({ ...draft, monthly });
                }}
                className="w-full bg-transparent text-sm font-medium tabular-nums text-gray-900 outline-none placeholder:text-gray-300"
              />
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">
        En €/MWh, el coste de los servicios de ajuste que la comercializadora cobra aparte.
        {draft.mode === "monthly" && " Cada lectura del SIPS va con el valor de su mes; un mes vacío toma la media de los demás."}
      </p>
    </div>
  );
}
