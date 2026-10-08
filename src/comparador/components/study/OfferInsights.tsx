"use client";

import { useState } from "react";
import { SupplierLogo } from "@/comercializadoras/components/SupplierLogo";
import { cn } from "@/core/utils";
import { euros, eurosRound, type StudyOfferView } from "./api";
import { OfferScatter } from "./OfferScatter";
import { Panel } from "./ui";

const FIRST = 8;

/** La mejor tarifa de cada comercializadora: la que más ahorra o, sin lo de hoy, la más barata. */
function bestBySupplier(offers: readonly StudyOfferView[], hasCurrent: boolean) {
  const best = new Map<string, StudyOfferView>();
  for (const offer of offers) {
    const current = best.get(offer.comercializadoraId);
    const better = hasCurrent ? (offer.savings ?? -Infinity) > (current?.savings ?? -Infinity) : offer.cost.total < (current?.cost.total ?? Infinity);
    if (!current || better) best.set(offer.comercializadoraId, offer);
  }
  return [...best.values()].sort((left, right) =>
    hasCurrent ? (right.savings ?? -Infinity) - (left.savings ?? -Infinity) : left.cost.total - right.cost.total,
  );
}

/**
 * Una barra por comercializadora con lo que ahorra su mejor tarifa (o lo que
 * cuesta, sin lo de hoy). Pulsar una barra lleva a esa tarifa.
 */
function SupplierBars({
  offers,
  hasCurrent,
  selectedKey,
  onSelect,
}: {
  offers: StudyOfferView[];
  hasCurrent: boolean;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const [all, setAll] = useState(false);
  const rows = bestBySupplier(offers, hasCurrent);
  const shown = all ? rows : rows.slice(0, FIRST);
  const value = (offer: StudyOfferView) => (hasCurrent ? (offer.savings ?? 0) : offer.cost.total);
  const max = Math.max(1, ...rows.map((offer) => Math.abs(value(offer))));

  return (
    <div className="px-5 pb-4 pt-3">
      <p className="mb-3 text-xs text-gray-500">
        {hasCurrent ? "Lo que ahorra al año la mejor tarifa de cada comercializadora." : "Lo que cuesta al año la tarifa más barata de cada comercializadora."}
      </p>
      <ul className="space-y-1">
        {shown.map((offer, index) => {
          const amount = value(offer);
          const saves = !hasCurrent || amount > 0;
          const active = offer.key === selectedKey;
          return (
            <li key={offer.comercializadoraId}>
              <button
                type="button"
                onClick={() => onSelect(offer.key)}
                title={`${offer.comercializadoraName} · ${offer.productName}`}
                className={cn(
                  "group grid w-full grid-cols-[10rem_1fr_6.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50 sm:grid-cols-[12rem_1fr_7rem]",
                  active && "bg-primary-50/70 hover:bg-primary-50",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <SupplierLogo supplier={{ name: offer.comercializadoraName, logo: offer.comercializadoraLogo }} size={24} className="rounded-md" />
                  <span className="truncate text-sm text-gray-800">{offer.comercializadoraName}</span>
                </span>
                <span className="h-2.5 rounded-full bg-gray-100">
                  <span
                    className={cn(
                      "block h-2.5 rounded-full transition-[width] duration-500",
                      !saves ? "bg-gray-300" : index === 0 ? "bg-primary-600" : "bg-primary-400 group-hover:bg-primary-500",
                    )}
                    style={{ width: `${Math.max(2, (Math.abs(amount) / max) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-sm tabular-nums">
                  {hasCurrent ? (
                    saves ? (
                      <span className="font-semibold text-gray-900">{euros(amount)}</span>
                    ) : (
                      <span className="text-gray-400">+{eurosRound(-amount)} más</span>
                    )
                  ) : (
                    <span className="font-medium text-gray-900">{euros(amount)}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > FIRST && (
        <button type="button" onClick={() => setAll((value) => !value)} className="mt-2 px-2 text-xs font-medium text-gray-500 hover:text-gray-900">
          {all ? "Ver menos" : `Ver las ${rows.length} comercializadoras`}
        </button>
      )}
    </div>
  );
}

/** Las ofertas de un vistazo: por comercializadora y, si hay comisiones, ahorro frente a comisión. */
export function OfferInsights({
  offers,
  hasCurrent,
  showCommission,
  proposalKeys,
  selectedKey,
  onSelect,
}: {
  offers: StudyOfferView[];
  hasCurrent: boolean;
  showCommission: boolean;
  proposalKeys: ReadonlySet<string>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const canScatter = showCommission && offers.filter(({ commission }) => commission !== null).length >= 2;
  const [view, setView] = useState<"suppliers" | "scatter">("suppliers");
  const active = canScatter ? view : "suppliers";

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 className="text-sm font-semibold text-gray-900">{hasCurrent ? "¿Dónde está el ahorro?" : "¿Qué cuesta cada una?"}</h2>
        {canScatter && (
          <div role="tablist" aria-label="Vista del gráfico" className="inline-flex rounded-lg bg-gray-100/80 p-0.5 text-xs">
            {(
              [
                ["suppliers", "Por comercializadora"],
                ["scatter", "Ahorro y comisión"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active === key}
                onClick={() => setView(key)}
                className={cn("rounded-md px-3 py-1", active === key ? "bg-white font-medium text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {active === "scatter" ? (
        <OfferScatter offers={offers} proposalKeys={proposalKeys} selectedKey={selectedKey} onSelect={onSelect} hasCurrent={hasCurrent} />
      ) : (
        <SupplierBars offers={offers} hasCurrent={hasCurrent} selectedKey={selectedKey} onSelect={onSelect} />
      )}
    </Panel>
  );
}
