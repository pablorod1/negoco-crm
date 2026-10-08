"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/core/components/ui/input";
import type { StudyOptionsInput, StudyView } from "./api";

/** «29,93» o «29.93» como número; null si está vacío o no lo es. */
export const parseFee = (text: string) => {
  const value = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(value) && value >= 0 ? value : null;
};

/** Botones de una sola elección, para opciones de 2 o 3 valores. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-0.5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => !selected && onChange(option.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                selected ? "bg-white font-medium text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Cómo se calcula el ranking: tipo de cliente, fee y orden. */
export function StudyFilters({
  study,
  busy,
  feeText,
  onFeeText,
  onOptions,
}: {
  study: StudyView;
  busy: boolean;
  feeText: string;
  onFeeText: (text: string) => void;
  onOptions: (options: StudyOptionsInput) => void;
}) {
  const [appliedFee, setAppliedFee] = useState(feeText);
  const applyFee = () => {
    if (feeText === appliedFee) return;
    setAppliedFee(feeText);
    onOptions({ feeEnergyPerMwh: parseFee(feeText) });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <Segmented
        label="Cliente"
        value={study.options.channel ?? "any"}
        options={[
          { value: "acquisition", label: "Captación" },
          { value: "renewal", label: "Renovación" },
          { value: "any", label: "Cualquiera" },
        ]}
        onChange={(value) => onOptions({ channel: value === "any" ? null : value })}
      />
      <div className="space-y-1">
        <label htmlFor="study-fee" className="text-xs font-medium text-gray-500">
          Fee de energía
        </label>
        <div className="relative">
          <Input
            id="study-fee"
            inputMode="decimal"
            className="h-9 w-40 pr-16"
            placeholder="El mínimo"
            value={feeText}
            onChange={(event) => onFeeText(event.target.value)}
            onBlur={applyFee}
            onKeyDown={(event) => event.key === "Enter" && applyFee()}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
            €/MWh
          </span>
        </div>
      </div>
      {study.showCommission && (
        <Segmented
          label="Ordenar por"
          value={study.options.order}
          options={[
            { value: "savings", label: "Ahorro" },
            { value: "commission", label: "Comisión" },
          ]}
          onChange={(order) => onOptions({ order })}
        />
      )}
      <p className="ml-auto flex items-center gap-2 pb-2 text-xs text-muted-foreground">
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {study.totalOffers} tarifas encajan · {study.ineligible} descartadas por el suministro
      </p>
    </div>
  );
}
