"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";
import type { CostBreakdown } from "@/comparador/engine/types";
import { SupplierLogo } from "@/comercializadoras/components/SupplierLogo";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { cn } from "@/core/utils";
import { euros, percentOf, unitPrice, type ProposalView, type StudyOfferView, type StudyView } from "./api";
import { Panel } from "./ui";

/** La propuesta ya generada para esta oferta con este fee, si la hay. */
export const proposalFor = (proposals: readonly ProposalView[], offer: StudyOfferView) =>
  proposals.find(
    (proposal) =>
      proposal.offerKey === offer.key &&
      proposal.feeEnergyPerMwh === offer.feeEnergyPerMwh &&
      proposal.annualTotal === offer.cost.total,
  );

function conditions(offer: StudyOfferView) {
  return [
    offer.termMonths ? `${offer.termMonths} meses` : null,
    offer.powerMode === "regulated" ? "Potencia BOE" : null,
    offer.level,
    offer.segment,
    offer.feeRange ? `Fee ${offer.feeEnergyPerMwh} €/MWh` : null,
    ...offer.discounts,
  ].filter((text): text is string => Boolean(text));
}

const COST_LINES: { label: string; pick: (cost: CostBreakdown) => number }[] = [
  { label: "Potencia", pick: (cost) => cost.power.total },
  { label: "Energía", pick: (cost) => cost.energy.total },
  { label: "Descuentos", pick: (cost) => cost.energyDiscounts.reduce((total, value) => total + value, 0) },
  { label: "Otros y bono social", pick: (cost) => cost.otherElectricity + cost.socialBonus },
  { label: "Impuesto eléctrico", pick: (cost) => cost.electricityTax },
  { label: "Contador y servicios", pick: (cost) => cost.meterRental + cost.services },
  { label: "IVA y otros", pick: (cost) => cost.vat + cost.vatExempt },
];

/** Precios y coste de una oferta frente a lo que paga hoy. */
function OfferDetail({ offer, current }: { offer: StudyOfferView; current: CostBreakdown | null }) {
  const prices = [
    ["Potencia P1", offer.prices.power.P1, "€/kW día"],
    ["Potencia P2", offer.prices.power.P2, "€/kW día"],
    ["Energía P1", offer.prices.energy.P1, "€/kWh"],
    ["Energía P2", offer.prices.energy.P2, "€/kWh"],
    ["Energía P3", offer.prices.energy.P3, "€/kWh"],
  ] as const;
  const lines = COST_LINES.filter(({ pick }) => pick(offer.cost) !== 0 || (current && pick(current) !== 0));

  return (
    <div className="grid gap-6 border-t border-gray-100 bg-gray-50/60 px-5 py-4 text-xs sm:grid-cols-[1fr_1.3fr]">
      <div>
        <p className="mb-2 font-medium text-gray-700">Precios con el fee incluido</p>
        <dl className="space-y-1.5">
          {prices.map(([label, value, unit]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-gray-500">{label}</dt>
              <dd className="tabular-nums text-gray-900">
                {unitPrice(value)} <span className="text-gray-400">{unit}</span>
              </dd>
            </div>
          ))}
        </dl>
        {offer.versionValidFrom && (
          <p className="mt-3 text-gray-400">
            Precios vigentes desde el {new Date(`${offer.versionValidFrom}T12:00:00Z`).toLocaleDateString("es-ES")}
          </p>
        )}
      </div>
      <div>
        <p className="mb-2 font-medium text-gray-700">Coste de un año</p>
        <table className="w-full tabular-nums">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left font-normal" />
              {current && <th className="pb-1 text-right font-normal">Hoy</th>}
              <th className="pb-1 text-right font-normal">Oferta</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ label, pick }) => (
              <tr key={label}>
                <td className="py-0.5 text-gray-500">{label}</td>
                {current && <td className="text-right text-gray-500">{euros(pick(current))}</td>}
                <td className="text-right text-gray-900">{euros(pick(offer.cost))}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 font-semibold text-gray-900">
              <td className="pt-1.5">Total</td>
              {current && <td className="pt-1.5 text-right">{euros(current.total)}</td>}
              <td className="pt-1.5 text-right">{euros(offer.cost.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface RowContext {
  study: StudyView;
  /** Hay comisión que enseñar: la ve quien puede y alguna tarifa la trae. */
  withCommission: boolean;
  bestKey: string | null;
  /** El mayor ahorro de la lista: escala la barra de cada tarifa. */
  maxSavings: number;
  selectedKey: string | null;
  proposing: string | null;
  onPropose: (offer: StudyOfferView) => void;
}

/** Una tarifa: nombre, condiciones, coste, ahorro, comisión y su propuesta. */
function OfferRow({
  offer,
  withLogo,
  indent = false,
  context,
}: {
  offer: StudyOfferView;
  withLogo: boolean;
  /** Tarifa secundaria de un grupo: alineada con la de arriba, sin logo. */
  indent?: boolean;
  context: RowContext;
}) {
  const { study, bestKey, maxSavings, selectedKey, proposing, onPropose, withCommission } = context;
  const [open, setOpen] = useState(false);
  const proposal = proposalFor(study.proposals, offer);
  const closed = study.status === "closed";
  const current = study.current;
  const saves = offer.savings !== null && offer.savings > 0;
  const tags = conditions(offer);
  const best = offer.key === bestKey;
  const selected = offer.key === selectedKey;

  return (
    <li id={`offer-${offer.key}`} className={cn("scroll-mt-24 transition-colors", selected && "bg-primary-50/60", proposal && !selected && "bg-primary-50/30")}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_7rem_9rem_6rem_11rem]">
        <div className="flex min-w-0 items-center gap-3">
          {withLogo && <SupplierLogo supplier={{ name: offer.comercializadoraName, logo: offer.comercializadoraLogo }} size={40} className="rounded-xl" />}
          {indent && <span className="w-10 shrink-0" aria-hidden />}
          <div className="min-w-0">
            {withLogo && <p className="text-sm font-semibold text-gray-900">{offer.comercializadoraName}</p>}
            <p className="flex flex-wrap items-center gap-2">
              <span className={cn("truncate text-sm", withLogo ? "text-gray-500" : "text-gray-700")} title={offer.productName}>
                {offer.productName}
              </span>
              {best && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700 ring-1 ring-success-200">
                  <Sparkles className="size-3" />
                  Mejor ahorro
                </span>
              )}
            </p>
            {tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden text-right lg:block">
          <p className="text-sm font-medium tabular-nums text-gray-900">{euros(offer.cost.total)}</p>
          <p className="text-[11px] text-gray-400">al año</p>
        </div>

        <div className="hidden lg:block">
          {current && offer.savings !== null ? (
            <>
              <div className="flex items-baseline justify-end gap-1.5">
                <p className={cn("text-sm font-semibold tabular-nums", saves ? "text-success-700" : "text-gray-400")}>
                  {saves ? euros(offer.savings) : `+${euros(-offer.savings)}`}
                </p>
                <p className="text-[11px] text-gray-400">{saves ? `${percentOf(offer.savings, current.total)} %` : "más"}</p>
              </div>
              <div className="ml-auto mt-1.5 h-1 w-full max-w-28 rounded-full bg-gray-100">
                {saves && maxSavings > 0 && (
                  <div className="h-1 rounded-full bg-success-500" style={{ width: `${Math.max(6, (offer.savings / maxSavings) * 100)}%` }} />
                )}
              </div>
            </>
          ) : (
            <p className="text-right text-sm text-gray-300">—</p>
          )}
        </div>

        <div className="hidden text-right lg:block">
          {withCommission && (
            <>
              <p className="text-sm tabular-nums text-gray-700">{offer.commission === null ? "—" : euros(offer.commission)}</p>
              <p className="text-[11px] text-gray-400">comisión</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-1">
          {proposal ? (
            <Button asChild size="sm" variant="outline" className="whitespace-nowrap rounded-lg">
              <a href={proposal.pdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Propuesta {proposal.number}
              </a>
            </Button>
          ) : (
            !closed && (
              <Button
                size="sm"
                variant={best ? "default" : "outline"}
                className="whitespace-nowrap rounded-lg"
                disabled={proposing !== null}
                onClick={() => onPropose(offer)}
              >
                {proposing === offer.key ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                Crear propuesta
              </Button>
            )
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg text-gray-400 hover:text-gray-900"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Ocultar el detalle" : "Ver precios y coste"}
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>

        {/* En pantallas estrechas, las cifras bajo el nombre. */}
        <div className="col-span-2 flex gap-5 text-xs tabular-nums text-gray-500 lg:hidden">
          <span>{euros(offer.cost.total)}/año</span>
          {offer.savings !== null && <span className={saves ? "font-medium text-success-700" : ""}>{saves ? `ahorra ${euros(offer.savings)}` : "no ahorra"}</span>}
          {withCommission && offer.commission !== null && <span>comisión {euros(offer.commission)}</span>}
        </div>
      </div>
      {open && <OfferDetail offer={offer} current={current} />}
    </li>
  );
}

/** Las tarifas de una comercializadora: la mejor a la vista y el resto plegado. */
function SupplierGroup({ offers, context }: { offers: StudyOfferView[]; context: RowContext }) {
  const [first, ...rest] = offers;
  const hasSelected = rest.some(({ key }) => key === context.selectedKey);
  const [open, setOpen] = useState(false);
  const expanded = open || hasSelected;

  return (
    <Panel className="overflow-hidden">
      <ul className="divide-y divide-gray-100">
        {(expanded ? offers : [first]).map((offer, index) => (
          <OfferRow key={offer.key} offer={offer} withLogo={index === 0} indent={index > 0} context={context} />
        ))}
      </ul>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Ver solo la mejor" : `Ver ${rest.length} ${rest.length === 1 ? "tarifa más" : "tarifas más"} de ${first.comercializadoraName}`}
        </button>
      )}
    </Panel>
  );
}

/** Agrupa las ofertas por comercializadora, en el orden de su mejor tarifa. */
function bySupplier(offers: readonly StudyOfferView[]) {
  const groups = new Map<string, StudyOfferView[]>();
  for (const offer of offers) {
    const group = groups.get(offer.comercializadoraId);
    if (group) group.push(offer);
    else groups.set(offer.comercializadoraId, [offer]);
  }
  return [...groups.values()];
}

const FIRST = 10;

function OfferSection({
  title,
  offers,
  grouped,
  context,
  collapsible = false,
}: {
  title: string;
  offers: StudyOfferView[];
  grouped: boolean;
  context: RowContext;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const [all, setAll] = useState(false);
  const hasSelected = offers.some(({ key }) => key === context.selectedKey);
  const visible = open || hasSelected;
  const groups = grouped ? bySupplier(offers) : null;
  const total = groups ? groups.length : offers.length;
  const showAll = all || hasSelected;

  return (
    <section className="space-y-3">
      <button
        type="button"
        disabled={!collapsible}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-900 disabled:cursor-default"
        aria-expanded={visible}
      >
        {collapsible && <ChevronDown className={cn("size-4 text-gray-400 transition-transform", !visible && "-rotate-90")} />}
        {title}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-500">{offers.length}</span>
      </button>
      {visible &&
        (groups ? (
          <div className="space-y-3">
            {(showAll ? groups : groups.slice(0, FIRST)).map((group) => (
              <SupplierGroup key={group[0].comercializadoraId} offers={group} context={context} />
            ))}
          </div>
        ) : (
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {(showAll ? offers : offers.slice(0, FIRST)).map((offer) => (
                <OfferRow key={offer.key} offer={offer} withLogo context={context} />
              ))}
            </ul>
          </Panel>
        ))}
      {visible && total > FIRST && !showAll && (
        <Button variant="ghost" size="sm" className="w-full text-gray-500" onClick={() => setAll(true)}>
          Ver {grouped ? `las ${total} comercializadoras` : `las ${total} tarifas`}
        </Button>
      )}
    </section>
  );
}

/**
 * Las ofertas: primero las que mejoran lo que paga hoy, agrupadas por
 * comercializadora; las que no mejoran, plegadas.
 */
export function OfferList({ offers, context }: { offers: StudyOfferView[]; context: RowContext }) {
  const [grouped, setGrouped] = useState(true);
  const { study, selectedKey } = context;

  // Al elegir un punto del gráfico, la tarifa se abre y se centra.
  useEffect(() => {
    if (!selectedKey) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById(`offer-${selectedKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [selectedKey]);

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-gray-900">Ofertas</h2>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        Agrupar por comercializadora
        <Switch checked={grouped} onCheckedChange={setGrouped} aria-label="Agrupar por comercializadora" />
      </label>
    </div>
  );

  if (offers.length === 0) {
    return (
      <div className="space-y-3">
        {header}
        <Panel className="p-10 text-center">
          <p className="text-sm font-medium text-gray-900">
            {study.offers.length === 0 ? "No hay tarifas que encajen con este suministro" : "Ninguna tarifa con estos filtros"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {study.offers.length === 0
              ? "Revisa los precios vigentes en Comercializadoras → Tarifas."
              : "Quita alguna comercializadora del filtro para ver más."}
          </p>
        </Panel>
      </div>
    );
  }

  const better = study.current ? offers.filter(({ savings }) => savings !== null && savings > 0) : offers;
  const worse = study.current ? offers.filter(({ savings }) => savings === null || savings <= 0) : [];

  return (
    <div className="space-y-5">
      {header}
      {better.length > 0 && (
        <OfferSection title={study.current ? "Mejoran lo que paga hoy" : "Tarifas por coste anual"} offers={better} grouped={grouped} context={context} />
      )}
      {worse.length > 0 && (
        <OfferSection
          title={better.length > 0 ? "No mejoran lo que paga hoy" : "Ninguna mejora lo que paga hoy"}
          offers={worse}
          grouped={grouped}
          context={context}
          collapsible={better.length > 0}
        />
      )}
    </div>
  );
}
