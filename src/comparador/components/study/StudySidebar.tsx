"use client";

import { useState, type Ref } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ExternalLink, Eye, FileText, PencilLine, ScanText } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";
import { euros, kw, kwh, percentOf, type ComparativaStudies, type StudyView } from "./api";
import { InvoicePreview } from "./InvoicePreview";
import { Eyebrow, Panel } from "./ui";

const TERRITORY: Record<string, string> = {
  peninsula: "Península",
  baleares: "Baleares",
  canarias: "Canarias",
  ceuta_melilla: "Ceuta y Melilla",
};

const POWER: Record<string, { label: string; className: string }> = {
  adequate: {
    label: "Potencia adecuada",
    className: "bg-success-50 text-success-700 ring-success-200",
  },
  oversized: {
    label: "Potencia de más",
    className: "bg-warning-50 text-warning-700 ring-warning-200",
  },
  exceeded: {
    label: "Supera la potencia",
    className: "bg-danger-50 text-danger ring-danger-200",
  },
};

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Consumo de 12 meses, potencia frente a máxima demanda y dónde está el suministro. */
function SupplyCard({ study }: { study: StudyView }) {
  const supply = study.supply!;
  const annual =
    supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;
  const periods = [
    {
      label: "Punta",
      period: "P1",
      value: supply.annualKwh.P1,
      className: "bg-primary-700",
    },
    {
      label: "Llano",
      period: "P2",
      value: supply.annualKwh.P2,
      className: "bg-primary-500",
    },
    {
      label: "Valle",
      period: "P3",
      value: supply.annualKwh.P3,
      className: "bg-primary-300",
    },
  ];
  const power = supply.power;
  const peak = power?.maxDemandKw ?? null;
  const contracted = Math.max(supply.contractedKw.P1, supply.contractedKw.P2);
  const scale =
    Math.max(contracted, peak ?? 0, power?.suggestedKw ?? 0) * 1.1 || 1;
  const location = supply.location;

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>Suministro</Eyebrow>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          {supply.consumptionSource === "sips"
            ? `SIPS · ${supply.sipsMonths} meses`
            : "Factura"}
        </span>
      </div>
      {study.cups && (
        <p className="mt-2 break-all font-mono text-xs text-gray-600">
          {study.cups}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        {[
          "2.0TD",
          TERRITORY[supply.territory] ?? supply.territory,
          supply.distributor,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-gray-700">Consumo anual</p>
          <p className="text-lg font-semibold tabular-nums tracking-tight text-gray-900">
            {kwh(annual)}
          </p>
        </div>
        <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {periods.map((period) => (
            <div
              key={period.period}
              className={period.className}
              style={{ width: `${percentOf(period.value, annual)}%` }}
              title={`${period.label}: ${kwh(period.value)}`}
            />
          ))}
        </div>
        <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
          {periods.map((period) => (
            <div key={period.period}>
              <dt className="flex items-center gap-1.5 text-gray-500">
                <span className={cn("size-2 rounded-full", period.className)} />
                {period.period} {period.label}
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums text-gray-900">
                {kwh(period.value)}{" "}
                <span className="font-normal text-gray-400">
                  {percentOf(period.value, annual)} %
                </span>
              </dd>
            </div>
          ))}
        </dl>
        {supply.consumptionSource !== "sips" && (
          <p className="mt-2 text-[11px] text-gray-400">
            Sin SIPS: el consumo de la factura llevado a un año.
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-gray-700">
            Potencia contratada
          </p>
          <p className="text-sm font-semibold tabular-nums text-gray-900">
            {kw(supply.contractedKw.P1)} / {kw(supply.contractedKw.P2)}
          </p>
        </div>
        {power && peak !== null ? (
          <>
            <div className="relative mt-3 h-2 rounded-full bg-gray-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gray-300"
                style={{ width: `${(contracted / scale) * 100}%` }}
              />
              <div
                className={cn(
                  "absolute -top-1 h-4 w-1 rounded-full ring-2 ring-white",
                  power.status === "exceeded" ? "bg-danger" : "bg-gray-900",
                )}
                style={{ left: `calc(${(peak / scale) * 100}% - 2px)` }}
                title={`Máxima demanda ${kw(peak)}`}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-1 rounded-full bg-gray-900" />
                Máxima demanda {kw(peak)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium ring-1",
                  POWER[power.status].className,
                )}
              >
                {POWER[power.status].label}
              </span>
            </div>
            {power.status !== "adequate" && (
              <p className="mt-2 text-xs text-gray-600">
                Conviene {power.status === "exceeded" ? "subirla" : "bajarla"} a{" "}
                <span className="font-medium">{kw(power.suggestedKw)}</span>. La
                propuesta se lo recomienda.
              </p>
            )}
            {supply.maxDemandKwByPeriod && (
              <p className="mt-2 text-[11px] text-gray-400">
                Máxima por periodo: P1 {kw(supply.maxDemandKwByPeriod.P1)} · P2{" "}
                {kw(supply.maxDemandKwByPeriod.P2)} · P3{" "}
                {kw(supply.maxDemandKwByPeriod.P3)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-[11px] text-gray-400">
            Sin SIPS no se conoce la máxima demanda.
          </p>
        )}
      </div>

      {location && (
        <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
          {[location.postalCode, location.municipality, location.province]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </Panel>
  );
}

const maskIban = (iban: string) => {
  const clean = iban.replace(/\s/g, "");
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
};

/** Lo que ya se sabe del titular: leído de la factura o confirmado al completar. */
function ClientCard({ study }: { study: StudyView }) {
  const client = study.client;
  const fields = client
    ? [
        ["Titular", [client.name, client.lastName].filter(Boolean).join(" ")],
        ["DNI o CIF", client.documentNumber],
        ["Teléfono", client.phone],
        ["Correo", client.email],
        ["IBAN", client.iban ? maskIban(client.iban) : null],
        [
          "Dirección",
          [client.address, client.postalCode, client.city]
            .filter(Boolean)
            .join(", "),
        ],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>Cliente</Eyebrow>
        {fields.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
            <ScanText className="size-3" />
            {study.status === "closed" ? "Confirmado" : "Leído de la factura"}
          </span>
        )}
      </div>
      {fields.length > 0 ? (
        <dl className="mt-3 space-y-2.5 text-sm">
          {fields.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="min-w-0 break-words text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          La factura no trae los datos del titular con su etiqueta. Se piden al
          completar.
        </p>
      )}
      {study.status !== "closed" && fields.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-400">
          Se revisan al completar el estudio y pasan al trámite.
        </p>
      )}
    </Panel>
  );
}

/** La factura analizada y lo que no cuadra en su lectura. */
function InvoiceCard({
  study,
  file,
  onReview,
}: {
  study: StudyView;
  file: ComparativaStudies["invoices"][number] | null;
  onReview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const period = study.invoice?.billingPeriod;
  const blocking = study.issues.some(({ severity }) => severity === "blocking");

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Factura</Eyebrow>
        {file && (
          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
          >
            <Eye className="size-3.5" />
            Ver factura
          </button>
        )}
      </div>
      <InvoicePreview file={previewing ? file : null} onClose={() => setPreviewing(false)} />
      <div className="mt-3 flex items-start gap-3">
        <span className="rounded-lg bg-gray-100 p-2 text-gray-500">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 text-sm">
          <p
            className="truncate font-medium text-gray-900"
            title={study.invoiceFileName ?? undefined}
          >
            {study.invoiceFileName}
          </p>
          <p className="text-xs text-gray-500">
            {[
              study.invoice?.supplierName,
              period?.from && period.to
                ? `${shortDate(period.from)} – ${shortDate(period.to)}`
                : null,
              study.invoice?.total ? euros(study.invoice.total) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {study.issues.length > 0 && (
        <div
          className={cn(
            "mt-4 rounded-xl p-3 text-xs ring-1",
            blocking
              ? "bg-danger-50 ring-danger-200"
              : "bg-warning-50 ring-warning-200",
          )}
        >
          <button
            type="button"
            className="flex w-full items-start gap-2 text-left"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                blocking ? "text-danger" : "text-warning-600",
              )}
            />
            <span className="flex-1 text-gray-800">
              <span className="font-medium">
                {blocking
                  ? study.invoiceReview.acceptedMismatch
                    ? "Las cuentas no cuadran, pero se han confirmado."
                    : "La lectura no cuadra del todo."
                  : "Avisos de la lectura."}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-gray-500 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
          {open && (
            <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-700">
              {study.issues.map((issue, index) => (
                <li key={index}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {study.invoiceReview.reviewedAt && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <CheckCircle2 className="size-3.5 text-success-600" />
          Revisada {study.invoiceReview.reviewedByEmail ? `por ${study.invoiceReview.reviewedByEmail} ` : ""}el{" "}
          {new Date(study.invoiceReview.reviewedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      {study.status !== "closed" && study.extraction && (
        <Button
          variant={study.invoiceReview.required ? "default" : "outline"}
          size="sm"
          className="mt-4 w-full rounded-lg"
          onClick={onReview}
        >
          <PencilLine className="size-3.5" />
          {study.invoiceReview.required ? "Revisar datos de la factura" : "Editar datos de la factura"}
        </Button>
      )}
    </Panel>
  );
}

/** Las propuestas creadas y el paso siguiente: completar el estudio. */
function ProposalsCard({
  study,
  onComplete,
  cardRef,
}: {
  study: StudyView;
  onComplete: () => void;
  cardRef?: Ref<HTMLDivElement>;
}) {
  const closed = study.status === "closed";
  const logoOf = (offerKey: string) =>
    study.offers.find(({ key }) => key === offerKey);

  return (
    <div ref={cardRef}>
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <Eyebrow>Propuestas</Eyebrow>
          {study.proposals.length > 0 && (
            <span className="text-xs tabular-nums text-gray-400">
              {study.proposals.length}
            </span>
          )}
        </div>
        {study.proposals.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-4 text-center">
            <FileText className="mx-auto size-5 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              Aún no hay propuestas
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Pulsa «Crear propuesta» en una tarifa: se abre el PDF que recibirá
              el cliente. Puedes crear varias.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {study.proposals.map((proposal) => {
              const offer = logoOf(proposal.offerKey);
              return (
                <li key={proposal.id}>
                  <a
                    href={proposal.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "group flex items-center gap-3 rounded-xl p-2.5 ring-1 transition-colors",
                      proposal.chosen
                        ? "bg-success-50/60 ring-success-200"
                        : "ring-gray-100 hover:bg-gray-50 hover:ring-gray-200",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold text-white">
                      {proposal.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                        {proposal.comercializadoraName}
                        {proposal.chosen && (
                          <CheckCircle2 className="size-3.5 text-success-600" />
                        )}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {offer?.productName ?? proposal.productName}
                      </span>
                    </span>
                    <span className="text-right text-xs tabular-nums">
                      <span className="block font-medium text-gray-900">
                        {euros(proposal.annualTotal)}
                      </span>
                      {proposal.savings !== null && proposal.savings > 0 && (
                        <span className="block text-success-700">
                          −{euros(proposal.savings)}
                        </span>
                      )}
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-gray-300 group-hover:text-gray-500" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        {!closed && study.proposals.length > 0 && (
          <Button
            className="mt-4 w-full rounded-xl"
            size="lg"
            onClick={onComplete}
          >
            Completar estudio
            <ArrowRight className="size-4" />
          </Button>
        )}
        {closed && (
          <p className="mt-3 text-xs text-gray-500">
            Estudio completado: el PDF elegido está en los documentos de la
            comparativa.
          </p>
        )}
      </Panel>
    </div>
  );
}

export function StudySidebar({
  study,
  onComplete,
  proposalsRef,
  invoiceFile,
  onReviewInvoice,
}: {
  study: StudyView;
  /** El PDF de la factura analizada, para abrirlo en el visor. */
  invoiceFile: ComparativaStudies["invoices"][number] | null;
  onReviewInvoice: () => void;
  onComplete: () => void;
  /** La tarjeta de propuestas, para saber cuándo sale de la vista. */
  proposalsRef?: Ref<HTMLDivElement>;
}) {
  return (
    <aside className="grid content-start items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
      <ProposalsCard
        study={study}
        onComplete={onComplete}
        cardRef={proposalsRef}
      />
      <SupplyCard study={study} />
      <ClientCard study={study} />
      <InvoiceCard study={study} file={invoiceFile} onReview={onReviewInvoice} />
    </aside>
  );
}
