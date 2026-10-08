"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Gauge, MapPin, TrendingDown, Zap } from "lucide-react";
import { euros, kwh, percentOf, type StudyOfferView, type StudyView } from "./api";

const TERRITORY: Record<string, string> = {
  peninsula: "Península",
  baleares: "Baleares",
  canarias: "Canarias",
  ceuta_melilla: "Ceuta y Melilla",
};

const kw = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 3 })} kW`;

/** Lo que paga hoy frente a la mejor oferta: la decisión de un vistazo. */
function Headline({ study, best }: { study: StudyView; best: StudyOfferView | null }) {
  const current = study.current?.total ?? null;
  const saving = best?.savings ?? null;
  const percent = saving !== null && current ? percentOf(saving, current) : null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Hoy paga</p>
        {current !== null ? (
          <>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {euros(current)}
              <span className="text-sm font-normal text-muted-foreground"> /año</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {study.invoice?.supplierName ?? "Comercializadora sin identificar"} · unos {euros(current / 12)} al mes
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-lg font-semibold text-gray-900">Sin calcular</p>
            <p className="text-sm text-muted-foreground">
              La factura no trae todos sus precios: las ofertas se ordenan por coste, sin ahorro.
            </p>
          </>
        )}
      </div>

      {best && saving !== null && saving > 0 ? (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-success-700">
            <TrendingDown className="size-3.5" />
            Mejor ahorro
          </p>
          <p className="mt-1 text-2xl font-semibold text-success-700">
            {euros(saving)}
            <span className="text-sm font-normal"> /año{percent !== null ? ` · ${percent} % menos` : ""}</span>
          </p>
          <p className="truncate text-sm text-gray-700">
            <span className="font-medium">{best.comercializadoraName}</span> · {best.productName}
          </p>
        </div>
      ) : best && current === null ? (
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Tarifa más barata</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {euros(best.cost.total)}
            <span className="text-sm font-normal text-muted-foreground"> /año</span>
          </p>
          <p className="truncate text-sm text-muted-foreground">
            <span className="font-medium text-gray-700">{best.comercializadoraName}</span> · {best.productName}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-warning-600">Sin ahorro</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">Ninguna tarifa mejora lo que paga hoy</p>
          <p className="text-sm text-muted-foreground">Mejor no proponer un cambio solo por precio.</p>
        </div>
      )}
    </div>
  );
}

/** Consumo, potencia y territorio en una línea, con el detalle por periodo. */
function SupplyStrip({ study }: { study: StudyView }) {
  const supply = study.supply!;
  const annual = supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;
  const items = [
    {
      icon: Zap,
      label: `${kwh(annual)}/año`,
      hint: `${supply.consumptionSource === "sips" ? `SIPS, ${supply.sipsMonths} meses` : "Factura llevada a un año"} · P1 ${percentOf(supply.annualKwh.P1, annual)} % · P2 ${percentOf(supply.annualKwh.P2, annual)} % · P3 ${percentOf(supply.annualKwh.P3, annual)} %`,
    },
    {
      icon: Gauge,
      label: `${kw(supply.contractedKw.P1)} / ${kw(supply.contractedKw.P2)}`,
      hint: supply.power ? `Máxima demanda ${kw(supply.power.maxDemandKw)}` : "Sin máxima demanda (no hay SIPS)",
    },
    {
      icon: MapPin,
      label: TERRITORY[supply.territory] ?? supply.territory,
      hint: supply.territorySource === "sips" ? "Según el SIPS" : "Sin SIPS: se da por Península",
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map(({ icon: Icon, label, hint }) => (
        <div key={label} className="flex items-start gap-2.5 rounded-xl bg-white px-3 py-2.5 ring-1 ring-gray-100">
          <Icon className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** La potencia, solo si conviene cambiarla: va en la propuesta del cliente. */
function PowerAdvice({ study }: { study: StudyView }) {
  const power = study.supply?.power;
  if (!power || power.status === "adequate") return null;
  const exceeded = power.status === "exceeded";
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm">
      <Gauge className="mt-0.5 size-4 shrink-0 text-warning-600" />
      <p className="text-gray-800">
        <span className="font-medium">
          {exceeded ? "La demanda supera la potencia contratada." : "Potencia sobredimensionada."}
        </span>{" "}
        Máxima demanda de {kw(power.maxDemandKw)}: conviene {exceeded ? "subirla" : "bajarla"} a{" "}
        {kw(power.suggestedKw)}. La propuesta se lo recomienda al cliente.
      </p>
    </div>
  );
}

/** Lo que no cuadra en la lectura de la factura, plegado bajo un resumen. */
function InvoiceIssues({ issues }: { issues: StudyView["issues"] }) {
  const [open, setOpen] = useState(false);
  if (issues.length === 0) return null;
  const blocking = issues.some(({ severity }) => severity === "blocking");

  return (
    <div
      className={`rounded-xl border p-3 text-sm ${blocking ? "border-danger-200 bg-danger-50" : "border-warning-200 bg-warning-50"}`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${blocking ? "text-danger" : "text-warning-600"}`} />
        <span className="flex-1 text-gray-800">
          <span className="font-medium">
            {blocking ? "Comprueba lo que paga hoy contra el PDF antes de proponer." : "Avisos de la lectura de la factura."}
          </span>{" "}
          {issues.length} {issues.length === 1 ? "aviso" : "avisos"}
        </span>
        <ChevronDown className={`mt-0.5 size-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-6.5 text-gray-700">
          {issues.map((issue, index) => (
            <li key={index} className="list-disc">
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cabecera del resultado: decisión, suministro y avisos. */
export function StudyOverview({ study, best }: { study: StudyView; best: StudyOfferView | null }) {
  return (
    <div className="space-y-3">
      <Headline study={study} best={best} />
      <SupplyStrip study={study} />
      <PowerAdvice study={study} />
      <InvoiceIssues issues={study.issues} />
    </div>
  );
}
