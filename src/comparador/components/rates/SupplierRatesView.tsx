"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
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
import { commissionAmount, commissionScope } from "./commission-text";
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
 * regla que `listActiveOfferPrices` y el ranking: 2.0TD, precio fijo, tarifa
 * activada y comercializadora activa. Las que cobran los SSAA aparte se
 * ofertan solo en los estudios que los apliquen (lo dice cada fila).
 */
function offerBlocker(row: StoredRatePrice, product: Product, supplierActive: boolean): string | null {
  if (!supplierActive) return "La comercializadora está desactivada en el CRM.";
  if (!product.enabled) return "Desactivada: no se ofrece en los estudios.";
  if (row.accessTariff !== "2.0TD") return `Es de ${row.accessTariff}; el comparador compara 2.0TD.`;
  if (row.pricing !== "fixed") return "Precio indexado: el comparador oferta precio fijo.";
  return null;
}

/** Condiciones de una fila como etiquetas, sin lo que ya se explica aparte. */
function conditionChips(row: StoredRatePrice): string[] {
  return describeConditions({ ...row, includesAncillaryServices: true })
    .split(" · ")
    .filter((part) => part && part !== "General")
    // El nivel suelto («I», «N2») no se entiende fuera de la tabla del anexo.
    .map((part) => (row.level && part === row.level ? `Nivel ${part}` : part));
}

/**
 * Vista «Tarifas» de una comercializadora (dirección y backoffice): cómo están
 * sus precios, cómo se actualizan (un correo al buzón), qué tarifas se ofertan
 * y por qué no las que no, sus comisiones y lo que ha ido llegando.
 */
export function SupplierRatesView({ comercializadoraId }: { comercializadoraId: string }) {
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

  const attention = data.ingests.filter(({ status }) =>
    ["received", "processing", "ready", "needs_review", "failed"].includes(status),
  );

  const toggleRate = async (rateId: string, enabled: boolean) => {
    await ratesApi.toggleRate(rateId, comercializadoraId, enabled);
    load();
  };

  return (
    <div className="space-y-6">
      <RatesHeader data={data} onUpload={() => setUploadOpen(true)} />

      {attention.length > 0 && <AttentionPanel ingests={attention} onOpen={setReviewing} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ProductsPanel data={data} onToggle={toggleRate} />
        <div className="space-y-6">
          <AncillaryDefaultPanel data={data} onSaved={load} />
          <CommissionsPanel data={data} />
          <ActivityPanel
            data={data}
            onOpen={setReviewing}
            onDiscard={async (versionId) => {
              await ratesApi.discardVersion(versionId, comercializadoraId);
              load();
            }}
          />
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

/** Estado de los precios, tres cifras y cómo se actualizan. */
function RatesHeader({ data, onUpload }: { data: SupplierRatesResponse; onUpload: () => void }) {
  const rows = data.rates.flatMap((product) => product.rows.map((row) => ({ row, product })));
  const offered = data.rates.filter((product) =>
    product.rows.some((row) => !offerBlocker(row, product, data.supplier.active)),
  );
  const cheapest = rows
    .filter(({ row, product }) => row.energy && !offerBlocker(row, product, data.supplier.active))
    .map(({ row }) => Math.min(row.energy!.P1, row.energy!.P2, row.energy!.P3));
  const lastUpdate = data.ingests.find(({ status }) => status === "approved");

  const state =
    data.freshness.status === "never"
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
                {data.activeVersion?.validFrom && ` · vigentes desde el ${formatDay(data.activeVersion.validFrom)}`}
              </p>
            </div>
          </div>
          {!data.supplier.active && (
            <p className="flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-gray-800 ring-1 ring-warning-200">
              <AlertTriangle className="size-4 shrink-0 text-warning-600" />
              {data.supplier.name} está desactivada en el CRM: sus tarifas no salen en los estudios.
            </p>
          )}
          <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
            <Figure label="Tarifas" value={String(data.rates.length)} />
            <Figure label="Se ofertan" value={String(offered.length)} />
            <Figure label="Energía desde" value={cheapest.length ? euros(Math.min(...cheapest)) : "—"} unit={cheapest.length ? "€/kWh" : undefined} />
          </dl>
        </div>

        <div className="space-y-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-950/[0.04] lg:w-[360px]">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Mail className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">Actualiza por correo</p>
              <p className="text-xs text-gray-500">Reenvía los anexos y se aplican solos.</p>
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
function AttentionPanel({ ingests, onOpen }: { ingests: IngestSummary[]; onOpen: (id: string) => void }) {
  return (
    <Panel className="bg-warning-50/40 ring-warning-200">
      <PanelHeader
        title={ingests.length === 1 ? "Un anexo necesita revisión" : `${ingests.length} anexos necesitan revisión`}
        description="No se han podido aplicar solos: la lectura no cuadra con el documento o ha fallado."
      />
      <ul className="divide-y divide-warning-100 px-5 pb-3 pt-2">
        {ingests.map((ingest) => (
          <li key={ingest.id} className="flex items-center gap-3 py-2.5">
            <AlertTriangle className="size-4 shrink-0 text-warning-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{ingestTitle(ingest)}</p>
              <p className="truncate text-xs text-gray-500">{ingest.error ?? ingest.reason ?? statusText(ingest).label}</p>
            </div>
            <Button size="sm" className="rounded-lg" onClick={() => onOpen(ingest.id)}>
              Revisar
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
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {data.rates.map((product) => (
            <ProductCard
              key={product.rateId}
              product={product}
              scale={scale}
              supplierActive={data.supplier.active}
              canManage={data.canManage}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ProductCard({
  product,
  scale,
  supplierActive,
  canManage,
  onToggle,
}: {
  product: Product;
  scale: number;
  supplierActive: boolean;
  canManage: boolean;
  onToggle: (rateId: string, enabled: boolean) => void;
}) {
  const blockers = product.rows.map((row) => offerBlocker(row, product, supplierActive));
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
        {product.rows.map((row, index) => (
          <RowPrices
            key={row.id}
            row={row}
            scale={scale}
            blocker={blockers[index]}
            first={index === 0}
          />
        ))}
      </div>
    </article>
  );
}

function RowPrices({
  row,
  scale,
  blocker,
  first,
}: {
  row: StoredRatePrice;
  scale: number;
  blocker: string | null;
  first: boolean;
}) {
  const chips = conditionChips(row);
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
            <span className="font-medium uppercase tracking-[0.08em]">Energía</span> · €/kWh
          </p>
          {(single ? [{ key: "P1" as const, label: "24 h" }] : PERIODS).map(({ key, label }) => (
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
      ) : (
        <p className="text-xs text-gray-500">Sin precio de energía.</p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Potencia</span>
        <span className="font-medium tabular-nums text-gray-900">
          {describePower(row)}
          {row.powerMode === "fixed" && row.power && <span className="ml-1 font-normal text-gray-400">€/kW·día</span>}
        </span>
      </div>

      {row.discounts.length > 0 && (
        <p className="text-[11px] text-gray-500">
          {row.discounts.map(({ text, conditional }) => `${text}${conditional ? " (con condiciones)" : ""}`).join(" · ")}
        </p>
      )}

      {!row.includesAncillaryServices && !blocker && (
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

function CommissionsPanel({ data }: { data: SupplierRatesResponse }) {
  return (
    <Panel>
      <PanelHeader title="Comisiones" description="Lo que paga la comercializadora por cada contrato." />
      {data.commissionRules.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-sm text-gray-500">
          Sin comisiones. Envía el marco de comisiones al mismo buzón y se aplicará solo.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 px-5 pb-3 pt-2">
          {data.commissionRules.map((rule) => (
            <li key={rule.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900">{commissionScope(rule, { withConsumption: true })}</p>
                <p className="text-[11px] text-gray-500">
                  Desde el {formatDay(rule.validFrom)}
                  {rule.validTo ? ` hasta el ${formatDay(rule.validTo)}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{commissionAmount(rule)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const ingestTitle = (ingest: IngestSummary) => ingest.fileName ?? ingest.emailSubject ?? "Texto pegado";

function statusText(ingest: IngestSummary): { label: string; className: string } {
  switch (ingest.status) {
    case "approved":
      return {
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
      return { label: "Por revisar", className: "bg-warning-50 text-warning-700 ring-warning-200" };
  }
}

/** Lo que ha ido llegando, lo más reciente arriba, y los precios programados. */
function ActivityPanel({
  data,
  onOpen,
  onDiscard,
}: {
  data: SupplierRatesResponse;
  onOpen: (id: string) => void;
  onDiscard: (versionId: string) => void;
}) {
  const scheduled = data.versions.filter(({ status }) => status === "scheduled");

  return (
    <Panel>
      <PanelHeader title="Actividad" description="Anexos recibidos y qué se hizo con cada uno." />
      {scheduled.length === 0 && data.ingests.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-sm text-gray-500">Todavía no ha llegado ningún anexo.</p>
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
          {data.ingests.map((ingest) => {
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
