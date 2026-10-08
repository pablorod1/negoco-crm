"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, FileText, Loader2 } from "lucide-react";
import type { CostBreakdown } from "@/comparador/engine/types";
import { Button } from "@/core/components/ui/button";
import { euros, percentOf, unitPrice, type ProposalView, type StudyOfferView, type StudyView } from "./api";

/** Cuántas ofertas se ven antes de «Ver todas». */
const FIRST_OFFERS = 8;

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
    <div className="grid gap-4 border-t bg-gray-50/70 px-4 py-3 text-xs sm:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="mb-1.5 font-medium text-gray-700">Precios con el fee</p>
        <dl className="space-y-1">
          {prices.map(([label, value, unit]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums text-gray-900">
                {unitPrice(value)} <span className="text-muted-foreground">{unit}</span>
              </dd>
            </div>
          ))}
        </dl>
        {offer.versionValidFrom && (
          <p className="mt-2 text-muted-foreground">
            Vigentes desde el {new Date(`${offer.versionValidFrom}T12:00:00Z`).toLocaleDateString("es-ES")}
          </p>
        )}
      </div>
      <div>
        <p className="mb-1.5 font-medium text-gray-700">Coste de un año</p>
        <table className="w-full tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-normal" />
              {current && <th className="text-right font-normal">Hoy</th>}
              <th className="text-right font-normal">Oferta</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ label, pick }) => (
              <tr key={label}>
                <td className="py-0.5 text-muted-foreground">{label}</td>
                {current && <td className="text-right">{euros(pick(current))}</td>}
                <td className="text-right text-gray-900">{euros(pick(offer.cost))}</td>
              </tr>
            ))}
            <tr className="border-t font-medium text-gray-900">
              <td className="pt-1">Total</td>
              {current && <td className="pt-1 text-right">{euros(current.total)}</td>}
              <td className="pt-1 text-right">{euros(offer.cost.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OfferRow({
  offer,
  rank,
  study,
  best,
  proposing,
  onPropose,
}: {
  offer: StudyOfferView;
  rank: number;
  study: StudyView;
  best: boolean;
  proposing: string | null;
  onPropose: (offer: StudyOfferView) => void;
}) {
  const [open, setOpen] = useState(false);
  const proposal = proposalFor(study.proposals, offer);
  const closed = study.status === "closed";
  const current = study.current;
  const saves = offer.savings !== null && offer.savings > 0;
  const tags = conditions(offer);

  return (
    <li className={proposal ? "bg-primary-50/40" : undefined}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span className="w-5 shrink-0 text-center text-xs font-medium text-gray-400">{rank}</span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">{offer.comercializadoraName}</span>
            {best && (
              <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700">
                Mejor ahorro
              </span>
            )}
          </p>
          <p className="truncate text-sm text-gray-600" title={offer.productName}>
            {offer.productName}
          </p>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="w-28 text-right">
          <p className="text-sm font-medium tabular-nums text-gray-900">{euros(offer.cost.total)}</p>
          <p className="text-xs text-muted-foreground">al año</p>
        </div>
        {current && offer.savings !== null && (
          <div className="w-28 text-right">
            <p className={`text-sm font-semibold tabular-nums ${saves ? "text-success-700" : "text-danger"}`}>
              {saves ? "" : "+"}
              {euros(Math.abs(offer.savings))}
            </p>
            <p className="text-xs text-muted-foreground">
              {saves ? `ahorra ${percentOf(offer.savings, current.total)} %` : "más caro"}
            </p>
          </div>
        )}
        {study.showCommission && (
          <div className="w-24 text-right">
            <p className="text-sm tabular-nums text-gray-700">
              {offer.commission === null ? "—" : euros(offer.commission)}
            </p>
            <p className="text-xs text-muted-foreground">comisión</p>
          </div>
        )}

        <div className="flex w-full items-center justify-end gap-1 sm:w-48">
          {proposal ? (
            <Button asChild size="sm" variant="outline" className="whitespace-nowrap">
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
                className="whitespace-nowrap"
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
            className="size-8"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Ocultar el detalle" : "Ver precios y coste"}
          >
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>
      {open && <OfferDetail offer={offer} current={current} />}
    </li>
  );
}

function OfferGroup({
  offers,
  startRank,
  limit,
  ...row
}: {
  offers: StudyOfferView[];
  startRank: number;
  limit: number;
  study: StudyView;
  bestKey: string | null;
  proposing: string | null;
  onPropose: (offer: StudyOfferView) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? offers : offers.slice(0, limit);
  return (
    <>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-white">
        {shown.map((offer, index) => (
          <OfferRow
            key={offer.key}
            offer={offer}
            rank={startRank + index}
            best={offer.key === row.bestKey}
            study={row.study}
            proposing={row.proposing}
            onPropose={row.onPropose}
          />
        ))}
      </ul>
      {offers.length > shown.length && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setAll(true)}>
          Ver las {offers.length} tarifas
        </Button>
      )}
    </>
  );
}

/**
 * Las ofertas, separadas en las que mejoran lo que paga hoy y las que no
 * (plegadas): lo primero que se ve es lo que se puede proponer.
 */
export function OfferList({
  study,
  bestKey,
  proposing,
  onPropose,
}: {
  study: StudyView;
  bestKey: string | null;
  proposing: string | null;
  onPropose: (offer: StudyOfferView) => void;
}) {
  const [showWorse, setShowWorse] = useState(false);
  const row = { study, bestKey, proposing, onPropose };

  if (study.offers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">
        No hay tarifas cargadas que encajen con este suministro. Revisa los precios vigentes en Comercializadoras →
        Tarifas.
      </div>
    );
  }

  if (!study.current) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Tarifas por coste anual</h3>
        <OfferGroup offers={study.offers} startRank={1} limit={FIRST_OFFERS} {...row} />
      </section>
    );
  }

  const better = study.offers.filter(({ savings }) => savings !== null && savings > 0);
  const worse = study.offers.filter(({ savings }) => savings === null || savings <= 0);

  return (
    <div className="space-y-4">
      {better.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Mejoran lo que paga hoy <span className="font-normal text-muted-foreground">({better.length})</span>
          </h3>
          <OfferGroup offers={better} startRank={1} limit={FIRST_OFFERS} {...row} />
        </section>
      )}
      {worse.length > 0 && better.length === 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Tarifas por coste anual <span className="font-normal text-muted-foreground">({worse.length})</span>
          </h3>
          <OfferGroup offers={worse} startRank={1} limit={FIRST_OFFERS} {...row} />
        </section>
      )}
      {worse.length > 0 && better.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowWorse((value) => !value)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            aria-expanded={showWorse}
          >
            <ChevronDown className={`size-4 transition-transform ${showWorse ? "rotate-180" : ""}`} />
            No mejoran lo que paga hoy <span className="font-normal text-muted-foreground">({worse.length})</span>
          </button>
          {showWorse && <OfferGroup offers={worse} startRank={better.length + 1} limit={FIRST_OFFERS} {...row} />}
        </section>
      )}
    </div>
  );
}
