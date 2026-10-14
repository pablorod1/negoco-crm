"use client";

import { useState } from "react";
import { Check, Gauge, Loader2, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { companyLogoUrl, isUnoptimizedLogo } from "@/comercializadoras/lib/logo-url";
import { Button } from "@/core/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/core/components/ui/dialog";
import { cn } from "@/core/utils";
import { AncillaryEditor, describeAncillary, draftOf, simulationOf } from "./AncillaryEditor";
import type { StudyOptionsInput, StudyView } from "./api";
import { Panel } from "./ui";

/** «29,93» o «29.93» como número; null si está vacío o no lo es. */
export const parseFee = (text: string) => {
  const value = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(value) && value >= 0 ? value : null;
};

export interface SupplierFacet {
  id: string;
  name: string;
  logo: string | null;
  offers: number;
}

/** Botones de una sola elección, para opciones de 2 o 3 valores. */
function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-700">
        {label}
        {hint && <span className="ml-1 font-normal text-gray-400">· {hint}</span>}
      </p>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-gray-100/80 p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => !selected && onChange(option.value)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm transition-all",
                selected ? "bg-white font-medium text-gray-900 shadow-sm ring-1 ring-gray-950/5" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Fee de energía con botones de ±1 €/MWh; se aplica al salir o con Intro. */
function FeeInput({ text, onText, onApply }: { text: string; onText: (text: string) => void; onApply: (text: string) => void }) {
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(200, (parseFee(text) ?? 0) + delta));
    const value = String(Math.round(next * 100) / 100);
    onText(value);
    onApply(value);
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor="study-fee" className="text-xs font-medium text-gray-700">
        Fee de energía
        <span className="ml-1 font-normal text-gray-400">· vacío = el mínimo</span>
      </label>
      <div className="flex h-[38px] items-center rounded-xl bg-gray-100/80 p-1">
        <button type="button" onClick={() => step(-1)} className="flex size-[30px] items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-gray-900" aria-label="Bajar el fee">
          <Minus className="size-3.5" />
        </button>
        <input
          id="study-fee"
          inputMode="decimal"
          placeholder="Mín."
          value={text}
          onChange={(event) => onText(event.target.value)}
          onBlur={() => onApply(text)}
          onKeyDown={(event) => event.key === "Enter" && onApply(text)}
          className="w-14 bg-transparent text-center text-sm font-medium tabular-nums text-gray-900 outline-none placeholder:text-gray-400"
        />
        <span className="pr-1 text-xs text-gray-400">€/MWh</span>
        <button type="button" onClick={() => step(1)} className="flex size-[30px] items-center justify-center rounded-lg text-gray-500 hover:bg-white hover:text-gray-900" aria-label="Subir el fee">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

const PRICING_HINT = {
  fixed: "en la factura se lee precio fijo",
  indexed: "en la factura se lee indexada",
  flat: "en la factura se lee tarifa plana",
  unknown: "la factura no lo dice: confírmalo",
} as const;

/**
 * «Aplicar SSAA»: los servicios de ajuste con los que se ofertan las tarifas
 * que los cobran aparte. Sin marcar por defecto; al aplicarlos se propone el
 * valor del tenant, que se puede cambiar.
 */
function AncillaryControl({ study, onOptions }: { study: StudyView; onOptions: (options: StudyOptionsInput) => void }) {
  const [open, setOpen] = useState(false);
  const { value, suggested } = study.ancillary;
  const [draft, setDraft] = useState(() => draftOf(value ?? suggested));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-700">
        Servicios de ajuste
        {study.withoutAncillary > 0 && !value && (
          <span className="ml-1 font-normal text-gray-400">
            · {study.withoutAncillary} {study.withoutAncillary === 1 ? "tarifa los necesita" : "tarifas los necesitan"}: se ofertan sin ellos
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          setDraft(draftOf(value ?? suggested));
          setOpen(true);
        }}
        className={cn(
          "flex h-[38px] items-center gap-2 rounded-xl px-3 text-sm ring-1 transition-colors",
          value ? "bg-primary-50 text-primary-800 ring-primary-200" : "bg-white text-gray-700 ring-gray-200 hover:ring-gray-300",
        )}
      >
        <Gauge className="size-4" />
        {value ? describeAncillary(value) : "Aplicar SSAA"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aplicar servicios de ajuste</DialogTitle>
            <DialogDescription>
              Algunas tarifas (precio fijo con los SSAA aparte) solo se pueden comparar con un valor de SSAA. Pon el de cada mes del año o una
              media{suggested && !value ? `; se propone el de por defecto (${describeAncillary(suggested)})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <AncillaryEditor draft={draft} onChange={setDraft} />
          <DialogFooter className="gap-2 sm:justify-between">
            {value ? (
              <Button
                variant="ghost"
                onClick={() => {
                  onOptions({ ancillary: null });
                  setOpen(false);
                }}
              >
                No aplicar
              </Button>
            ) : (
              <span />
            )}
            <Button
              disabled={!simulationOf(draft)}
              onClick={() => {
                onOptions({ ancillary: simulationOf(draft) });
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Cómo se calcula y qué se ve del ranking: tipo de cliente, fee, orden y comercializadoras. */
export function StudyFilters({
  study,
  busy,
  feeText,
  onFeeText,
  onOptions,
  suppliers,
  selected,
  onToggleSupplier,
  onClearSuppliers,
}: {
  study: StudyView;
  busy: boolean;
  feeText: string;
  onFeeText: (text: string) => void;
  onOptions: (options: StudyOptionsInput) => void;
  suppliers: SupplierFacet[];
  selected: ReadonlySet<string>;
  onToggleSupplier: (id: string) => void;
  onClearSuppliers: () => void;
}) {
  const [appliedFee, setAppliedFee] = useState(feeText);
  const applyFee = (text: string) => {
    if (text === appliedFee) return;
    setAppliedFee(text);
    onOptions({ feeEnergyPerMwh: parseFee(text) });
  };

  return (
    <Panel className="p-5">
      <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-gray-100 pb-5">
        <Segmented
          label="Su tarifa de hoy"
          hint={study.invoice?.pricing ? PRICING_HINT[study.invoice.pricing] : undefined}
          value={study.currentInfo?.pricing ?? "fixed"}
          options={[
            { value: "fixed", label: "Precio fijo" },
            { value: "indexed", label: "Indexada" },
            { value: "flat", label: "Tarifa plana" },
          ]}
          onChange={(currentPricing) => onOptions({ currentPricing })}
        />
        <AncillaryControl study={study} onOptions={onOptions} />
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Segmented
          label="Tipo de cliente"
          value={study.options.channel ?? "any"}
          options={[
            { value: "acquisition", label: "Captación" },
            { value: "renewal", label: "Renovación" },
            { value: "any", label: "Cualquiera" },
          ]}
          onChange={(value) => onOptions({ channel: value === "any" ? null : value })}
        />
        <FeeInput text={feeText} onText={onFeeText} onApply={applyFee} />
        {study.showCommission && (
          <Segmented
            label="Ordenar por"
            value={study.options.order}
            options={[
              { value: "savings", label: "Ahorro del cliente" },
              { value: "commission", label: "Comisión" },
            ]}
            onChange={(order) => onOptions({ order })}
          />
        )}
        <p className="ml-auto flex items-center gap-2 pb-2 text-xs text-gray-500">
          {busy && <Loader2 className="size-3.5 animate-spin text-primary-600" />}
          <span className="tabular-nums">
            <span className="font-medium text-gray-900">{study.totalOffers}</span> tarifas encajan ·{" "}
            {study.ineligible} descartadas por potencia, consumo o territorio
          </span>
        </p>
      </div>

      {suppliers.length > 1 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-medium text-gray-700">Comercializadoras</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearSuppliers}
              aria-pressed={selected.size === 0}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                selected.size === 0 ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-600 ring-gray-200 hover:ring-gray-300",
              )}
            >
              Todas
            </button>
            {suppliers.map((supplier) => {
              const active = selected.has(supplier.id);
              const logo = companyLogoUrl(supplier.logo);
              return (
                <button
                  key={supplier.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleSupplier(supplier.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs ring-1 transition-all",
                    active ? "bg-primary-50 text-primary-800 ring-primary-300" : "bg-white text-gray-700 ring-gray-200 hover:ring-gray-300",
                  )}
                >
                  <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-gray-100">
                    {active ? (
                      <Check className="size-3.5 text-primary-600" />
                    ) : logo ? (
                      <Image src={logo} alt="" width={40} height={40} className="size-4 object-contain" unoptimized={isUnoptimizedLogo(supplier.logo)} />
                    ) : (
                      <span className="text-[10px] font-semibold text-gray-500">{supplier.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="font-medium">{supplier.name}</span>
                  <span className="tabular-nums text-gray-400">{supplier.offers}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
