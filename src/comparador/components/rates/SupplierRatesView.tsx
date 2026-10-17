"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileUp,
  Gauge,
  Mail,
  Upload,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Skeleton } from "@/core/components/ui/skeleton";
import { Switch } from "@/core/components/ui/switch";
import { cn } from "@/core/utils";
import { AncillaryEditor, describeAncillary, draftOf, simulationOf } from "@/comparador/components/study/AncillaryEditor";
import { Eyebrow, Panel, PanelHeader } from "@/comparador/components/study/ui";
import {
  describeConditions,
  describePower,
  formatDay,
  formatMoment,
  ratesApi,
  type AncillarySimulation,
  type IngestSummary,
  type StoredRatePrice,
  type SupplierRatesResponse,
} from "./api";
import { energyOfTariff, GAS_ACCESS_TARIFFS } from "@/comparador/gas/regulated";
import { commissionAmount, commissionScope } from "./commission-text";
import { historyMonthsFor, describeCoverage, IndexHistoryPanel, indexedProducts } from "./IndexHistoryPanel";
import { IngestReviewSheet } from "./IngestReviewSheet";
import { RateUploadDialog } from "./RateUploadDialog";

type Product = SupplierRatesResponse["rates"][number];

const PERIODS = [
  { key: "P1", label: "Punta" },
  { key: "P2", label: "Llano" },
  { key: "P3", label: "Valle" },
] as const;

/** 0,149 €/kWh: tres decimales siempre, hasta seis si los tiene. */
const euros = (value: number) =>
  value.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 6 });

const sinceDays = (days: number | null) => (!days ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`);

/**
 * Por qué una fila no sale en los estudios; null si se oferta. Es la misma
 * regla que `listActiveOfferPrices` y el ranking: 2.0TD o gas (RL.1 a RL.4), precio fijo o
 * indexado, tarifa activada y comercializadora activa. Las que cobran los SSAA
 * aparte se ofertan solo en los estudios que los apliquen, y las indexadas
 * solo si su histórico cubre el consumo del cliente (lo dice cada fila).
 */
function offerBlocker(row: StoredRatePrice, product: Product, data: SupplierRatesResponse): string | null {
  if (!data.supplier.active) return "La comercializadora está desactivada en el CRM.";
  if (!product.enabled) return "Desactivada: no se ofrece en los estudios.";
  if (row.accessTariff !== "2.0TD" && !(GAS_ACCESS_TARIFFS as readonly string[]).includes(row.accessTariff)) {
    return `Es de ${row.accessTariff}; el comparador compara 2.0TD y gas de RL.1 a RL.4.`;
  }
  if (row.pricing === "indexed" && energyOfTariff(row.accessTariff) === "gas") {
    return "Gas indexado: de momento solo se oferta gas a precio fijo.";
  }
  if (row.pricing === "indexed") {
    return historyMonthsFor(data.indexHistory, product.rateId).length > 0
      ? null
      : "Indexada sin histórico: no se oferta hasta cargar lo que cobró cada mes.";
  }
  if (row.pricing !== "fixed") return "Tarifa por franjas o plana: el comparador no sabe calcularla.";
  return null;
}

/** Condiciones de una fila como etiquetas, sin lo que ya se explica aparte. */
function conditionChips(row: StoredRatePrice): string[] {
  const parts = describeConditions({ ...row, includesAncillaryServices: true })
    .split(" · ")
    .filter((part) => part && part !== "General");
  // El nivel va el primero. Suelto («I», «N2») no se entiende fuera de la
  // tabla del anexo; si repite el territorio (Axpo: nivel «Baleares»), sobra.
  const [first, ...rest] = row.level ? parts : ["", ...parts];
  const level = row.level && !rest.includes(first) ? [`Nivel ${first}`] : [];
  return [...new Set([...level, ...rest])];
}

/** Filas que se ven de cada tarifa antes de «Ver todas»: Axpo trae 40 por producto. */
const VISIBLE_ROWS = 3;

export type RatesSection = "tarifas" | "comisiones";

/** Si un anexo toca la sección: sin leer todavía (o fallido), toca a las dos. */
const concerns = (ingest: IngestSummary, section: RatesSection) =>
  !ingest.contents || (section === "tarifas" ? ingest.contents.prices : ingest.contents.commissions);

/**
 * Vistas «Tarifas» y «Comisiones» de una comercializadora (dirección y
 * backoffice). Tarifas: cómo están sus precios, cómo se actualizan (un correo
 * al buzón), qué tarifas se ofertan y por qué no las que no, y el histórico
 * del indexado. Comisiones: lo que paga por contrato. Cada una con los anexos
 * que le tocan.
 */
export function SupplierRatesView({
  comercializadoraId,
  section = "tarifas",
}: {
  comercializadoraId: string;
  section?: RatesSection;
}) {
  const [data, setData] = useState<SupplierRatesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    ratesApi
      .supplier(comercializadoraId)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se han podido cargar las tarifas");
      });
    return () => {
      cancelled = true;
    };
  }, [comercializadoraId, reloadKey]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <RatesSkeleton />;

  const ingests = data.ingests.filter((ingest) => concerns(ingest, section));
  const attention = ingests.filter(({ status }) =>
    ["received", "processing", "ready", "needs_review", "failed"].includes(status),
  );
  const hasIndexed = indexedProducts(data).length > 0 || data.indexHistory.length > 0;
  const activity = (
    <ActivityPanel
      data={data}
      ingests={ingests}
      section={section}
      onOpen={setReviewing}
      onDiscard={async (versionId) => {
        await ratesApi.discardVersion(versionId, comercializadoraId);
        load();
      }}
    />
  );

  const toggleRate = async (rateId: string, enabled: boolean) => {
    await ratesApi.toggleRate(rateId, comercializadoraId, enabled);
    load();
  };

  return (
    <div className="space-y-6">
      <RatesHeader data={data} section={section} onUpload={() => setUploadOpen(true)} />

      {attention.length > 0 && (
        <AttentionPanel ingests={attention} onOpen={setReviewing} reviewer={data.canManageCatalog} />
      )}

      {/* La columna lateral va arriba: el histórico se ve sin bajar por todas las tarifas. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {section === "tarifas" ? (
            <ProductsPanel data={data} onToggle={toggleRate} />
          ) : (
            <CommissionsPanel data={data} />
          )}
        </div>
        <div className="min-w-0 space-y-6">
          {section === "tarifas" ? (
            <>
              {hasIndexed && <IndexHistoryPanel data={data} onSaved={load} />}
              <FeePanel data={data} onSaved={load} />
              <AncillaryDefaultPanel data={data} onSaved={load} />
              {activity}
              {!hasIndexed && <IndexHistoryPanel data={data} onSaved={load} />}
            </>
          ) : (
            activity
          )}
        </div>
      </div>

      <RateUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        comercializadoraId={comercializadoraId}
        supplierName={data.supplier.name}
        onProcessed={(id) => {
          load();
          setReviewing(id);
        }}
      />
      <IngestReviewSheet ingestId={reviewing} onClose={() => setReviewing(null)} onChanged={load} />
    </div>
  );
}

/** Estado de los precios (o de las comisiones), tres cifras y cómo se actualizan. */
function RatesHeader({
  data,
  section,
  onUpload,
}: {
  data: SupplierRatesResponse;
  section: RatesSection;
  onUpload: () => void;
}) {
  const rows = data.rates.flatMap((product) => product.rows.map((row) => ({ row, product })));
  const offered = data.rates.filter((product) =>
    product.rows.some((row) => !offerBlocker(row, product, data)),
  );
  const cheapest = rows
    .filter(({ row, product }) => row.energy && energyOfTariff(row.accessTariff) === "electricity" && !offerBlocker(row, product, data))
    .map(({ row }) => Math.min(row.energy!.P1, row.energy!.P2, row.energy!.P3));
  const lastUpdate = data.ingests.find(({ status }) => status === "approved");

  const current = currentRules(data);
  const latestRules = current.reduce<string | null>((latest, { validFrom }) => (!latest || validFrom > latest ? validFrom : latest), null);

  const state =
    section === "comisiones"
      ? current.length === 0
        ? { tone: "bg-gray-300", title: "Sin comisiones todavía", text: `Envía el marco de comisiones de ${data.supplier.name} al buzón y se aplicará al revisarlo.` }
        : { tone: "bg-success-500", title: "Comisiones cargadas", text: `Vigentes desde el ${formatDay(latestRules)}` }
      : data.freshness.status === "never"
      ? { tone: "bg-gray-300", title: "Sin precios todavía", text: `Envía el anexo de ${data.supplier.name} al buzón y se aplicará solo.` }
      : data.freshness.status === "stale"
        ? { tone: "bg-warning-500", title: `Sin actualizar desde hace ${data.freshness.days} días`, text: "Comprueba que no hay un anexo más reciente." }
        : {
            tone: "bg-success-500",
            title: "Precios al día",
            text: `Actualizados ${sinceDays(data.freshness.days)}${lastUpdate?.channel === "email" ? " por correo" : ""}`,
          };

  return (
    <Panel className="overflow-hidden">
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0 space-y-5">
          <div className="flex items-start gap-3">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", state.tone)} aria-hidden />
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-gray-900">{state.title}</h2>
              <p className="text-sm text-gray-500">
                {state.text}
                {section === "tarifas" && data.activeVersion?.validFrom && ` · vigentes desde el ${formatDay(data.activeVersion.validFrom)}`}
              </p>
            </div>
          </div>
          {!data.supplier.active && (
            <p className="flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-gray-800 ring-1 ring-warning-200">
              <AlertTriangle className="size-4 shrink-0 text-warning-600" />
              {data.supplier.name} está desactivada en el CRM: sus tarifas no salen en los estudios.
            </p>
          )}
          {section === "tarifas" ? (
            <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
              <Figure label="Tarifas" value={String(data.rates.length)} />
              <Figure label="Se ofertan" value={String(offered.length)} />
              <Figure label="Luz desde" value={cheapest.length ? euros(Math.min(...cheapest)) : "—"} unit={cheapest.length ? "€/kWh" : undefined} />
            </dl>
          ) : (
            <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
              <Figure label="Reglas" value={String(current.length)} />
              <Figure label="Luz" value={String(current.filter(({ energy }) => energy !== "gas").length)} />
              <Figure label="Gas" value={String(current.filter(({ energy }) => energy === "gas").length)} />
            </dl>
          )}
        </div>

        <div className="space-y-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-950/[0.04] lg:w-[360px]">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Mail className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">Actualiza por correo</p>
              <p className="text-xs text-gray-500">
                {section === "tarifas" ? "Reenvía los anexos y se aplican solos." : "Reenvía el marco de comisiones al mismo buzón."}
              </p>
            </div>
          </div>
          {data.mailbox ? <MailboxAddress address={data.mailbox} /> : <p className="text-xs text-gray-500">El buzón no está configurado.</p>}
          {data.canManage && (
            <Button variant="outline" size="sm" className="w-full rounded-lg" onClick={onUpload}>
              <Upload className="size-3.5" /> O sube el anexo aquí
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-950/[0.04]">
      <dt><Eyebrow>{label}</Eyebrow></dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-gray-500">{unit}</span>}
      </dd>
    </div>
  );
}

function MailboxAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200">
      <span className="min-w-0 flex-1 break-all font-mono text-xs text-gray-900">{address}</span>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        onClick={() => {
          void navigator.clipboard?.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
      >
        {copied ? <Check className="size-3.5 text-success-600" /> : <Copy className="size-3.5" />}
        {copied ? "Copiada" : "Copiar"}
      </button>
    </div>
  );
}

/** Solo si algo necesita a una persona: lecturas dudosas, errores o anexos sin leer. */
function AttentionPanel({
  ingests,
  onOpen,
  reviewer,
}: {
  ingests: IngestSummary[];
  onOpen: (id: string) => void;
  /** Negoco revisa; el tenant solo ve que se está revisando. */
  reviewer: boolean;
}) {
  const many = ingests.length > 1;
  return (
    <Panel className="bg-warning-50/40 ring-warning-200">
      <PanelHeader
        title={
          reviewer
            ? many ? `${ingests.length} anexos necesitan revisión` : "Un anexo necesita revisión"
            : many ? `Negoco está revisando ${ingests.length} anexos` : "Negoco está revisando un anexo"
        }
        description={
          reviewer
            ? "No se han podido aplicar solos: la lectura no cuadra con el documento o ha fallado."
            : "Se aplicarán en cuanto estén revisados. No tenéis que hacer nada."
        }
      />
      <ul className="divide-y divide-warning-100 px-5 pb-3 pt-2">
        {ingests.map((ingest) => (
          <li key={ingest.id} className="flex items-center gap-3 py-2.5">
            <AlertTriangle className="size-4 shrink-0 text-warning-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{ingestTitle(ingest)}</p>
              <p className="truncate text-xs text-gray-500">{ingest.error ?? ingest.reason ?? statusText(ingest).label}</p>
            </div>
            <Button size="sm" variant={reviewer ? "default" : "outline"} className="rounded-lg" onClick={() => onOpen(ingest.id)}>
              {reviewer ? "Revisar" : "Ver"}
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ProductsPanel({
  data,
  onToggle,
}: {
  data: SupplierRatesResponse;
  onToggle: (rateId: string, enabled: boolean) => void;
}) {
  // Una misma escala para todas: así se comparan las tarifas de un vistazo.
  const scale = Math.max(
    0.0001,
    ...data.rates.flatMap(({ rows }) => rows.flatMap(({ energy }) => (energy ? [energy.P1, energy.P2, energy.P3] : []))),
  );

  return (
    <Panel>
      <PanelHeader
        title="Tarifas vigentes"
        description="Precios sin impuestos. Las que no se ofertan no salen en los estudios."
      />
      {data.rates.length === 0 ? (
        <div className="px-5 pb-6 pt-4 text-sm text-gray-500">
          Todavía no hay precios de {data.supplier.name}. En cuanto llegue su anexo al buzón, aparecerán aquí.
        </div>
      ) : (
        <div className="@container p-5">
          <div className="grid gap-4 @2xl:grid-cols-2">
          {data.rates.map((product) => (
            <ProductCard
              key={product.rateId}
              product={product}
              scale={scale}
              data={data}
              onToggle={onToggle}
            />
          ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ProductCard({
  product,
  scale,
  data,
  onToggle,
}: {
  product: Product;
  scale: number;
  data: SupplierRatesResponse;
  onToggle: (rateId: string, enabled: boolean) => void;
}) {
  const canManage = data.canManage;
  const [expanded, setExpanded] = useState(false);
  const blockers = product.rows.map((row) => offerBlocker(row, product, data));
  const hidden = expanded ? 0 : Math.max(0, product.rows.length - VISIBLE_ROWS);
  const coverage = describeCoverage(historyMonthsFor(data.indexHistory, product.rateId));
  const offeredRows = blockers.filter((blocker) => blocker === null).length;
  const status =
    offeredRows === product.rows.length
      ? { label: "Se oferta", className: "bg-success-50 text-success-700 ring-success-200" }
      : offeredRows > 0
        ? { label: "Se oferta en parte", className: "bg-info-50 text-info-700 ring-info-200" }
        : { label: "No se oferta", className: "bg-gray-100 text-gray-600 ring-gray-200" };

  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl bg-white p-4 ring-1 ring-gray-950/[0.07] transition-opacity",
        offeredRows === 0 && "opacity-75",
      )}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900" title={product.name}>
            {product.name}
          </h3>
          <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", status.className)}>
            {status.label}
          </span>
        </div>
        {canManage && (
          <Switch
            aria-label={`Ofrecer ${product.name}`}
            checked={product.enabled}
            onCheckedChange={(value) => onToggle(product.rateId, value)}
          />
        )}
      </header>

      <div className="mt-3 space-y-3 divide-y divide-gray-100">
        {product.rows.slice(0, product.rows.length - hidden).map((row, index) => (
          <RowPrices
            key={row.id}
            row={row}
            scale={scale}
            blocker={blockers[index]}
            first={index === 0}
            coverage={coverage}
          />
        ))}
      </div>
      {product.rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-primary-600 hover:text-primary-700"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ver menos" : `Ver las ${product.rows.length} condiciones (${hidden} más)`}
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </article>
  );
}

function RowPrices({
  row,
  scale,
  blocker,
  first,
  coverage,
}: {
  row: StoredRatePrice;
  scale: number;
  blocker: string | null;
  first: boolean;
  /** Indexada: los meses de histórico que tiene. */
  coverage: string | null;
}) {
  const gas = energyOfTariff(row.accessTariff) === "gas";
  const chips = [...(gas ? [`Gas ${row.accessTariff}`] : []), ...conditionChips(row)];
  const single = row.energy && row.energy.P1 === row.energy.P2 && row.energy.P2 === row.energy.P3;

  return (
    <div className={cn("space-y-2.5", !first && "pt-3")}>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span key={chip} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
              {chip}
            </span>
          ))}
        </div>
      )}

      {row.energy ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-500">
            <span className="font-medium uppercase tracking-[0.08em]">{gas ? "Término variable" : "Energía"}</span> · €/kWh
          </p>
          {(single || gas ? [{ key: "P1" as const, label: gas ? "Gas" : "24 h" }] : PERIODS).map(({ key, label }) => (
            <div key={key} className="grid grid-cols-[44px_minmax(0,1fr)_76px] items-center gap-2 text-xs">
              <span className="text-gray-500">{label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span
                  className={cn("block h-full rounded-full", blocker ? "bg-gray-300" : "bg-primary-500")}
                  style={{ width: `${Math.max(4, (row.energy![key] / scale) * 100)}%` }}
                />
              </span>
              <span className="text-right font-medium tabular-nums text-gray-900">{euros(row.energy![key])}</span>
            </div>
          ))}
        </div>
      ) : row.pricing === "indexed" ? (
        <div className="space-y-1 text-xs">
          <p className="text-gray-700">
            <span className="mr-1.5 rounded-md bg-info-50 px-1.5 py-0.5 text-[11px] font-medium text-info-700">Indexada</span>
            Energía de cada mes según su histórico
            {row.feeEnergyMinPerMwh !== null &&
              ` · fee ${row.feeEnergyMinPerMwh}${row.feeEnergyMaxPerMwh !== null && row.feeEnergyMaxPerMwh !== row.feeEnergyMinPerMwh ? `–${row.feeEnergyMaxPerMwh}` : ""} €/MWh`}
          </p>
          {coverage && <p className="text-[11px] text-gray-500">Histórico {coverage}.</p>}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Sin precio de energía.</p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{gas ? "Término fijo" : "Potencia"}</span>
        <span className="font-medium tabular-nums text-gray-900">
          {gas ? describePower(row).replace(/^Fijo:?\s*/, "") : describePower(row)}
          {!gas && row.powerMode === "fixed" && row.power && <span className="ml-1 font-normal text-gray-400">€/kW·día</span>}
        </span>
      </div>

      {row.discounts.length > 0 && (
        <p className="text-[11px] text-gray-500">
          {row.discounts.map(({ text, conditional }) => `${text}${conditional ? " (con condiciones)" : ""}`).join(" · ")}
        </p>
      )}

      {gas && !row.includesAncillaryServices && !blocker && (
        <p className="flex gap-1.5 rounded-lg bg-info-50 px-2.5 py-1.5 text-[11px] text-info-700">
          <Gauge className="mt-px size-3 shrink-0" />
          Variable sin peajes: en los estudios se le suman los peajes y cargos del BOE de su RL.
        </p>
      )}

      {!gas && !row.includesAncillaryServices && !blocker && (
        <p className="flex gap-1.5 rounded-lg bg-info-50 px-2.5 py-1.5 text-[11px] text-info-700">
          <Gauge className="mt-px size-3 shrink-0" />
          SSAA aparte: solo se oferta en los estudios con «Aplicar SSAA».
        </p>
      )}

      {blocker && (
        <p className="flex gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600">
          <AlertTriangle className="mt-px size-3 shrink-0 text-gray-400" />
          {blocker}
        </p>
      )}
    </div>
  );
}

/** «30» o «30,5» como número; null si está vacío; NaN si no es un número. */
const feeOf = (text: string) => (text.trim() ? Number(text.replace(",", ".")) : null);
const feeText = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));
const validFee = (value: number | null) => value === null || (Number.isFinite(value) && value >= 0 && value <= 500);

/**
 * El fee que la agencia suma a los precios base de la comercializadora: el
 * habitual (el que se aplica en el estudio si el comercial no pone otro) y el
 * máximo. Los anexos no lo traen: lo decide cada agencia. Uno general sirve
 * para las comercializadoras sin uno propio.
 */
function FeePanel({ data, onSaved }: { data: SupplierRatesResponse; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ habitual: "", max: "", general: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseProducts = data.rates.filter((product) => product.rows.some((row) => row.feeEnergyMinPerMwh !== null)).length;
  const values = { habitual: feeOf(draft.habitual), max: feeOf(draft.max), general: feeOf(draft.general) };
  const valid = validFee(values.habitual) && validFee(values.max) && validFee(values.general);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await ratesApi.saveFee(data.supplier.id, { habitual: values.habitual, max: values.max });
      if (values.general !== data.fee.general) await ratesApi.saveFee(null, { habitual: values.general });
      setEditing(false);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido guardar");
    } finally {
      setSaving(false);
    }
  };

  const { own, general, effective } = data.fee;
  return (
    <Panel>
      <PanelHeader
        title="Fee de los precios base"
        description={`Lo que suma vuestra agencia a los precios base de ${data.supplier.name}: los anexos no lo traen. En el estudio se aplica el habitual si el comercial no pone otro.`}
        action={
          data.canManage && !editing ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setDraft({ habitual: feeText(own.habitual), max: feeText(own.max), general: feeText(general) });
                setEditing(true);
              }}
            >
              {own.habitual !== null || own.max !== null ? "Cambiar" : "Poner"}
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-3 px-5 pb-5 pt-3">
        {editing ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-gray-600">
                Habitual (€/MWh)
                <input
                  className="w-full rounded-md border px-2 py-1.5 text-sm"
                  inputMode="decimal"
                  placeholder={general !== null ? `General: ${feeText(general)}` : "Sin fijar"}
                  value={draft.habitual}
                  onChange={(event) => setDraft((current) => ({ ...current, habitual: event.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs text-gray-600">
                Máximo (€/MWh)
                <input
                  className="w-full rounded-md border px-2 py-1.5 text-sm"
                  inputMode="decimal"
                  placeholder="Sin tope"
                  value={draft.max}
                  onChange={(event) => setDraft((current) => ({ ...current, max: event.target.value }))}
                />
              </label>
            </div>
            <label className="block space-y-1 text-xs text-gray-600">
              Habitual general, para las comercializadoras sin uno propio (€/MWh)
              <input
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                inputMode="decimal"
                placeholder="Sin fijar"
                value={draft.general}
                onChange={(event) => setDraft((current) => ({ ...current, general: event.target.value }))}
              />
            </label>
            {!valid && <p className="text-xs text-danger">Escribe un número entre 0 y 500, o déjalo vacío.</p>}
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={saving || !valid} onClick={save}>
                Guardar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums text-gray-900">
              {effective.habitual !== null ? `Habitual ${feeText(effective.habitual)} €/MWh` : "Sin fee habitual"}
              {effective.max !== null ? ` · máximo ${feeText(effective.max)} €/MWh` : ""}
            </p>
            <p className="text-xs text-gray-500">
              {own.habitual === null && general !== null ? "Es el general de la agencia. " : ""}
              {effective.habitual === null
                ? "Sin él, los precios base se ofertan con el fee mínimo del anexo hasta que el comercial ponga otro. "
                : ""}
              {baseProducts > 0
                ? `${baseProducts} ${baseProducts === 1 ? "tarifa" : "tarifas"} de ${data.supplier.name} ${baseProducts === 1 ? "es" : "son"} de precio base.`
                : `Ninguna tarifa de ${data.supplier.name} es de precio base.`}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * SSAA por defecto del tenant: el valor que propone «Aplicar SSAA» en cada
 * estudio. No se aplican solos: el comercial los marca y los puede cambiar.
 */
function AncillaryDefaultPanel({ data, onSaved }: { data: SupplierRatesResponse; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(data.ancillaryDefault));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const affected = data.rates.filter((product) => product.rows.some((row) => !row.includesAncillaryServices)).length;

  const save = async (value: AncillarySimulation | null) => {
    setSaving(true);
    setError(null);
    try {
      await ratesApi.saveAncillaryDefault(value);
      setEditing(false);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se han podido guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Servicios de ajuste por defecto"
        description="Para todas las comercializadoras: el valor que propone «Aplicar SSAA» en cada estudio, donde se puede cambiar. Sin aplicarlos, las tarifas que cobran los SSAA aparte no se ofertan."
        action={
          data.canManage && !editing ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setDraft(draftOf(data.ancillaryDefault));
                setEditing(true);
              }}
            >
              {data.ancillaryDefault ? "Cambiar" : "Poner"}
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-3 px-5 pb-5 pt-3">
        {editing ? (
          <>
            <AncillaryEditor draft={draft} onChange={setDraft} />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-between gap-2">
              {data.ancillaryDefault ? (
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => save(null)}>
                  Quitar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={saving || !simulationOf(draft)} onClick={() => save(simulationOf(draft))}>
                  Guardar
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums text-gray-900">
              {data.ancillaryDefault ? describeAncillary(data.ancillaryDefault) : "Sin valor por defecto"}
            </p>
            <p className="text-xs text-gray-500">
              {affected > 0
                ? `${affected} ${affected === 1 ? "tarifa" : "tarifas"} de ${data.supplier.name} ${affected === 1 ? "cobra" : "cobran"} los SSAA aparte.`
                : `Ninguna tarifa de ${data.supplier.name} cobra los SSAA aparte.`}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

type Rule = SupplierRatesResponse["commissionRules"][number];

/** Las reglas que valen hoy (o desde una fecha futura): las cerradas son historia. */
function currentRules(data: SupplierRatesResponse): Rule[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  return data.commissionRules.filter(({ validTo }) => !validTo || validTo >= today);
}

const money = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 2 });

const band = (rule: Rule) =>
  rule.minAnnualKwh === null && rule.maxAnnualKwh === null
    ? "Cualquier consumo"
    : `${money((rule.minAnnualKwh ?? 0) / 1000)}–${rule.maxAnnualKwh === null ? "∞" : money(rule.maxAnnualKwh / 1000)} MWh`;

/**
 * Comisiones vigentes, una línea por producto, tarifa y nivel: los tramos de
 * consumo (Axpo trae decenas por nivel) se despliegan. Luz y gas por separado.
 */
function CommissionsPanel({ data }: { data: SupplierRatesResponse }) {
  const current = currentRules(data);
  const closed = data.commissionRules.length - current.length;
  const sections = (["electricity", "gas"] as const)
    .map((energy) => ({ energy, rules: current.filter((rule) => (rule.energy ?? "electricity") === energy) }))
    .filter(({ rules }) => rules.length > 0);

  return (
    <Panel>
      <PanelHeader
        title="Comisiones vigentes"
        description={`Lo que paga ${data.supplier.name} por cada contrato. En los estudios se aplica la regla más concreta que encaje con la tarifa, el nivel y el consumo del cliente.`}
      />
      {current.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-sm text-gray-500">
          Sin comisiones. Envía el marco de comisiones al mismo buzón: se aplicará al revisarlo.
        </p>
      ) : (
        <div className="space-y-5 px-5 pb-5 pt-3">
          {sections.map(({ energy, rules }) => (
            <section key={energy} className="space-y-2">
              {sections.length > 1 && <Eyebrow>{energy === "gas" ? "Gas" : "Luz"}</Eyebrow>}
              <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-950/[0.06]">
                {groupRules(rules).map((group) => (
                  <RuleGroup key={group.key} rules={group.rules} />
                ))}
              </ul>
            </section>
          ))}
          {closed > 0 && (
            <p className="text-xs text-gray-500">
              {closed === 1 ? "Hay 1 regla anterior que ya no vale" : `Hay ${closed} reglas anteriores que ya no valen`}: las sustituyó un marco más reciente.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

function groupRules(rules: Rule[]): { key: string; rules: Rule[] }[] {
  const groups = new Map<string, Rule[]>();
  for (const rule of rules) {
    const key = [commissionScope(rule, { withConsumption: false }), rule.pricing, rule.validFrom, rule.validTo].join("|");
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  return [...groups].map(([key, grouped]) => ({
    key,
    rules: grouped.sort((left, right) => (left.minAnnualKwh ?? 0) - (right.minAnnualKwh ?? 0)),
  }));
}

function RuleGroup({ rules }: { rules: Rule[] }) {
  const [open, setOpen] = useState(false);
  const [first] = rules;
  const banded = rules.length > 1;
  const amounts = rules.map(({ amount }) => amount);
  const summary =
    banded && first.ruleType === "fixed"
      ? `${money(Math.min(...amounts))}–${money(Math.max(...amounts))} €`
      : commissionAmount(first);
  return (
    <li className="px-3 py-2.5">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left disabled:cursor-default"
        disabled={!banded}
        aria-expanded={banded ? open : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-gray-900">{commissionScope(first, { withConsumption: !banded })}</span>
          <span className="block text-[11px] text-gray-500">
            Desde el {formatDay(first.validFrom)}
            {first.validTo ? ` hasta el ${formatDay(first.validTo)}` : ""}
            {banded ? ` · ${rules.length} tramos de consumo` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-gray-900">
          {summary}
          {banded && <ChevronDown className={cn("size-3.5 text-gray-400 transition-transform", open && "rotate-180")} />}
        </span>
      </button>
      {banded && open && (
        <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-xs text-gray-500 sm:grid-cols-2 xl:grid-cols-3">
          {rules.map((rule) => (
            <li key={rule.id} className="flex justify-between gap-3">
              <span>{band(rule)}</span>
              <span className="tabular-nums text-gray-900">{commissionAmount(rule)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const ingestTitle = (ingest: IngestSummary) => ingest.fileName ?? ingest.emailSubject ?? "Texto pegado";

function statusText(ingest: IngestSummary): { label: string; className: string } {
  switch (ingest.status) {
    case "approved":
      return ingest.progress
        ? {
            label: `Aplicado en parte · ${ingest.progress.approvedRows}/${ingest.progress.totalRows}`,
            className: "bg-success-50 text-success-700 ring-success-200",
          }
        : {
            label: ingest.channel === "email" ? "Aplicado solo" : "Aplicado",
            className: "bg-success-50 text-success-700 ring-success-200",
          };
    case "rejected":
      return { label: "Descartado", className: "bg-gray-100 text-gray-600 ring-gray-200" };
    case "out_of_scope":
      return { label: "No aplica", className: "bg-gray-100 text-gray-600 ring-gray-200" };
    case "failed":
      return { label: "Error", className: "bg-danger-50 text-danger ring-danger-200" };
    case "processing":
    case "received":
      return { label: "Leyendo", className: "bg-info-50 text-info-700 ring-info-200" };
    default:
      return { label: "En revisión por Negoco", className: "bg-warning-50 text-warning-700 ring-warning-200" };
  }
}

/** Lo que ha ido llegando, lo más reciente arriba, y los precios programados. */
function ActivityPanel({
  data,
  ingests,
  section,
  onOpen,
  onDiscard,
}: {
  data: SupplierRatesResponse;
  /** Los anexos que tocan a esta vista. */
  ingests: IngestSummary[];
  section: RatesSection;
  onOpen: (id: string) => void;
  onDiscard: (versionId: string) => void;
}) {
  const scheduled = section === "tarifas" ? data.versions.filter(({ status }) => status === "scheduled") : [];

  return (
    <Panel>
      <PanelHeader title="Actividad" description="Anexos recibidos y qué se hizo con cada uno." />
      {scheduled.length === 0 && ingests.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-sm text-gray-500">
          {section === "tarifas" ? "Todavía no ha llegado ningún anexo de precios." : "Todavía no ha llegado ningún marco de comisiones."}
        </p>
      ) : (
        <ol className="relative space-y-1 px-5 pb-4 pt-3">
          {scheduled.map((version) => (
            <li key={version.id} className="flex items-start gap-3 rounded-xl px-2 py-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info-50 text-info-600">
                <CalendarClock className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">Precios programados</p>
                <p className="text-xs text-gray-500">Entran en vigor el {formatDay(version.validFrom)}</p>
              </div>
              {data.canManage && (
                <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => onDiscard(version.id)}>
                  Descartar
                </Button>
              )}
            </li>
          ))}
          {ingests.map((ingest) => {
            const status = statusText(ingest);
            const note = ingest.status === "rejected" || ingest.status === "failed" ? ingest.error : ingest.status === "out_of_scope" ? ingest.reason : null;
            return (
              <li key={ingest.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-gray-50"
                  onClick={() => onOpen(ingest.id)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    {ingest.status === "approved" ? (
                      <CheckCircle2 className="size-3.5 text-success-600" />
                    ) : ingest.channel === "email" ? (
                      <Mail className="size-3.5" />
                    ) : (
                      <FileUp className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{ingestTitle(ingest)}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {formatMoment(ingest.receivedAt)}
                      {ingest.channel === "email" && ingest.emailFrom ? ` · ${ingest.emailFrom}` : ""}
                    </span>
                    {note && <span className="mt-0.5 block text-xs text-gray-500">{note}</span>}
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", status.className)}>
                    {status.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function RatesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
