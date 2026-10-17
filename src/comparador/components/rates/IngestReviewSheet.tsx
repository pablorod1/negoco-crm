"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/core/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import {
  describeConditions,
  describePower,
  formatDay,
  formatPrice,
  ratesApi,
  type DiffEntry,
  type IngestDetailResponse,
  type IngestReview,
  type RateIssue,
} from "./api";
import { commissionAmount, commissionScope } from "./commission-text";

const KIND_LABEL: Record<DiffEntry["kind"], { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  added: { label: "Nueva", variant: "success" },
  changed: { label: "Cambia", variant: "warning" },
  unchanged: { label: "Igual", variant: "default" },
  removed: { label: "Se retira", variant: "danger" },
  carried: { label: "Se mantiene", variant: "info" },
};

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function energyCell(entry: DiffEntry) {
  const next = entry.proposed?.energy ?? null;
  const previous = entry.active?.energy ?? null;
  const show = (value: { P1: number; P2: number; P3: number } | null) =>
    value
      ? value.P1 === value.P2 && value.P2 === value.P3
        ? formatPrice(value.P1)
        : `${formatPrice(value.P1)} / ${formatPrice(value.P2)} / ${formatPrice(value.P3)}`
      : "—";
  if (!entry.proposed) return show(previous);
  // La energía de una indexada sale de su histórico mensual, no del anexo.
  if (entry.proposed.pricing === "indexed") return <span className="text-muted-foreground">Indexada · histórico</span>;
  return (
    <div>
      <div className="font-medium">{show(next)}</div>
      {previous && entry.kind === "changed" && (
        <div className="text-xs text-muted-foreground line-through">{show(previous)}</div>
      )}
    </div>
  );
}

function IssueList({ issues }: { issues: RateIssue[] }) {
  // El mismo aviso para varias filas («Clásico 1 precio: no da la
  // potencia» en cuatro niveles) se enseña una vez con cuántas son.
  const grouped = new Map<string, { issue: RateIssue; count: number }>();
  for (const issue of issues) {
    if (issue.severity === "info") continue;
    const key = `${issue.severity}|${issue.message}`;
    const entry = grouped.get(key);
    if (entry) entry.count++;
    else grouped.set(key, { issue, count: 1 });
  }
  if (grouped.size === 0) return null;
  return (
    <ul className="space-y-1">
      {[...grouped.values()].map(({ issue, count }, index) => (
        <li
          key={`${issue.code}-${index}`}
          className={`flex gap-2 text-sm ${issue.severity === "blocking" ? "text-danger" : "text-warning-600"}`}
        >
          {issue.severity === "blocking" ? (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>
            {issue.message}
            {count > 1 && <span className="text-muted-foreground"> ({count} filas)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Revisión de una ingesta: lo que cambia frente a la versión activa, con el
 * fragmento del documento junto a cada fila. Las filas se pueden excluir y
 * las que no traen potencia pueden llevar la regulada; nada se teclea a mano.
 */
/** Los niveles ya resueltos (deducidos o recordados) de una revisión. */
function levelMapOf(review: IngestReview | null): Record<string, string | null> {
  return Object.fromEntries((review?.commissionLevels ?? []).map(({ level, mappedTo }) => [level, mappedTo]));
}

function commissionEnergies(commissions: IngestReview["commissions"]): string {
  const energies = new Set(commissions.map(({ energy }) => energy ?? "electricity"));
  return energies.size === 2 ? "luz y gas" : energies.has("gas") ? "gas" : "luz";
}

type Commission = IngestReview["commissions"][number];
type LevelChoice = IngestReview["commissionLevels"][number];

const fmtEuros = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 2 });

/**
 * Niveles del anexo de comisiones que no se llaman como los de las tarifas
 * (Axpo: «S», «E», «X» frente a «SUPER (N1)», «N2», «N3»): quien revisa dice
 * a cuál equivale cada uno y se recuerda para el siguiente anexo.
 */
function LevelMapping({
  choices,
  supplierName,
  disabled,
  onChange,
}: {
  choices: LevelChoice[];
  supplierName: string;
  disabled: boolean;
  onChange: (level: string, mappedTo: string | null) => void;
}) {
  const pending = choices.filter(({ mappedTo }) => !mappedTo).length;
  return (
    <div className={`rounded-md border p-3 space-y-2 text-sm ${pending ? "border-warning-200 bg-warning-50/40" : ""}`}>
      <p>
        Los niveles de este anexo no se llaman como los de las tarifas de {supplierName}. Indica a cuál equivale cada
        uno{pending ? ` (${pending === 1 ? "falta uno" : `faltan ${pending}`}: sin él, esas comisiones no se aplican)` : ""}:
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {choices.map((choice) => (
          <label key={`${choice.energy}-${choice.level}`} className="flex items-center gap-2">
            <span className="font-medium">
              «{choice.level}»{choices.some(({ energy }) => energy !== choice.energy) ? (choice.energy === "gas" ? " (gas)" : " (luz)") : ""}
            </span>
            <span className="text-muted-foreground">=</span>
            <select
              className="rounded-md border px-2 py-1"
              value={choice.mappedTo ?? ""}
              disabled={disabled}
              onChange={(event) => onChange(choice.level, event.target.value || null)}
            >
              <option value="">Elige el nivel</option>
              {choice.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {choice.source === "suggested" && <span className="text-xs text-muted-foreground">deducido</span>}
            {choice.source === "remembered" && <span className="text-xs text-muted-foreground">del anexo anterior</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Las comisiones agrupadas por producto, tarifa y nivel: un anexo como el de
 * Axpo trae cientos de tramos de consumo, y lo que se revisa es a qué tarifas
 * se aplica cada grupo. Los tramos se despliegan.
 */
function CommissionGroups({ commissions }: { commissions: Commission[] }) {
  const groups = new Map<string, Commission[]>();
  for (const rule of commissions) {
    const key = [commissionScope(rule, { withConsumption: false }), rule.documentLevel, rule.energy, rule.pricing].join("|");
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  return (
    <ul className="divide-y rounded-md border text-sm">
      {[...groups].map(([key, rules]) => {
        const [first] = rules;
        const amounts = rules.map(({ amount }) => amount);
        const banded = rules.length > 1;
        return (
          <li key={key} className="px-3 py-2">
            <details>
              <summary className={`flex cursor-pointer list-none items-start gap-3 ${banded ? "" : "pointer-events-none"}`}>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {commissionScope(first, { withConsumption: !banded })}
                    {first.documentLevel && (
                      <span className="font-normal text-muted-foreground"> · «{first.documentLevel}» en el anexo</span>
                    )}
                  </span>
                  <span className={`block text-xs ${first.covers.length === 0 ? "text-warning-600" : "text-muted-foreground"}`}>
                    {first.covers.length === 0
                      ? first.uncovered
                      : `Se aplica a: ${first.covers.slice(0, 6).join(", ")}${first.covers.length > 6 ? ` y ${first.covers.length - 6} más` : ""}`}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {banded && first.ruleType === "fixed"
                    ? `${fmtEuros(Math.min(...amounts))}–${fmtEuros(Math.max(...amounts))} €`
                    : commissionAmount(first)}
                  {banded && <span className="block text-xs text-muted-foreground">{rules.length} tramos ▾</span>}
                </span>
              </summary>
              {banded && (
                <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                  {rules.map((rule, index) => (
                    <li key={index} className="flex justify-between gap-3">
                      <span>{consumptionBand(rule)}</span>
                      <span className="tabular-nums text-foreground">{commissionAmount(rule)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}

const consumptionBand = (rule: Commission) =>
  rule.minAnnualKwh === null && rule.maxAnnualKwh === null
    ? "Cualquier consumo"
    : `${fmtEuros((rule.minAnnualKwh ?? 0) / 1000)}–${rule.maxAnnualKwh === null ? "∞" : fmtEuros(rule.maxAnnualKwh / 1000)} MWh`;

/** «29,93» o «29.93» como número; NaN si no lo es. */
const parseDecimal = (text: string) => (text.trim() ? Number(text.replace(",", ".")) : Number.NaN);

export function IngestReviewSheet({
  ingestId,
  onClose,
  onChanged,
}: {
  ingestId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<IngestDetailResponse | null>(null);
  const [review, setReview] = useState<IngestReview | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [regulated, setRegulated] = useState<Set<string>>(new Set());
  // Mantener las tarifas que no trae el anexo (Endesa manda uno por familia).
  const [partial, setPartial] = useState(false);
  // Potencia indicada a mano (€/kW·año) para las filas que no la traen.
  const [manualPower, setManualPower] = useState<Record<string, { p1: number; p2: number }>>({});
  const [powerDraft, setPowerDraft] = useState({ p1: "", p2: "" });
  const [validFrom, setValidFrom] = useState(today());
  const [includeCommissions, setIncludeCommissions] = useState(true);
  // Nivel de las tarifas que corresponde a cada nivel del anexo de comisiones.
  const [levelMap, setLevelMap] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<null | "preview" | "approve" | "reject" | "process">(null);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const { activeSuppliers } = useActiveEnergySuppliers();
  const previewRequest = useRef(0);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ingestId) return;
    let cancelled = false;
    ratesApi
      .ingest(ingestId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setReview(data.review);
        setExcluded(new Set());
        setRegulated(new Set());
        setPartial(data.review?.partialUpdate ?? false);
        setManualPower({});
        setPowerDraft({ p1: "", p2: "" });
        setValidFrom(data.review?.validFrom ?? today());
        setLevelMap(levelMapOf(data.review));
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se ha podido cargar");
      });
    return () => {
      cancelled = true;
    };
  }, [ingestId, reloadKey]);

  const loading = Boolean(ingestId) && detail?.ingest.id !== ingestId && !error;

  const preview = async (
    nextExcluded: Set<string>,
    nextRegulated: Set<string>,
    nextPartial: boolean = partial,
    nextManual: Record<string, { p1: number; p2: number }> = manualPower,
    nextLevelMap: Record<string, string | null> = levelMap,
  ) => {
    if (!ingestId) return;
    const requestId = ++previewRequest.current;
    setBusy("preview");
    try {
      const data = await ratesApi.preview(ingestId, {
        excludedRowKeys: [...nextExcluded],
        regulatedPowerRowKeys: [...nextRegulated],
        manualPower: nextManual,
        partialUpdate: nextPartial,
        levelMap: nextLevelMap,
      });
      if (requestId === previewRequest.current) setReview(data.review);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido recalcular");
    } finally {
      if (requestId === previewRequest.current) setBusy(null);
    }
  };

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const missingPower = useMemo(
    () =>
      new Set(
        [...(detail?.issues ?? []), ...(detail?.review?.issues ?? [])]
          .filter(({ code, rowKey }) => code === "missing_power" && rowKey)
          .map(({ rowKey }) => rowKey!),
      ),
    [detail],
  );

  // Las filas excluidas siguen en la tabla para poder recuperarlas.
  const entries = useMemo(() => {
    const current = review?.entries ?? [];
    const original = detail?.review?.entries ?? [];
    const shown = new Set(current.map(({ rowKey, key }) => rowKey ?? key));
    return [...current, ...original.filter(({ rowKey, key }) => !shown.has(rowKey ?? key))];
  }, [review, detail]);

  // Las cifras de comisión que no están en el documento solo bloquean si se guardan las comisiones.
  const blocking = (review?.issues ?? []).filter(
    ({ severity, code }) =>
      severity === "blocking" && !(code === "commission_not_in_source" && !includeCommissions),
  );
  // Decidir es de Negoco: el tenant envía el anexo y ve en qué está.
  const canDecide = detail?.canManageCatalog && ["ready", "needs_review"].includes(detail.ingest.status);
  const negocoReviewing = !detail?.canManageCatalog && ["ready", "needs_review", "failed"].includes(detail?.ingest.status ?? "");
  // Un anexo solo de comisiones no toca los precios: la tabla solo repetiría los vigentes.
  const bringsPrices = Boolean(review?.entries.some(({ kind }) => kind !== "carried"));
  const savesCommissions = Boolean(review?.commissions.length) && includeCommissions;

  const run = async (action: "approve" | "reject" | "process") => {
    if (!ingestId) return;
    setBusy(action);
    setError(null);
    try {
      if (action === "approve") {
        await ratesApi.approve(ingestId, {
          validFrom,
          excludedRowKeys: [...excluded],
          regulatedPowerRowKeys: [...regulated],
          manualPower,
          partialUpdate: partial,
          includeCommissions,
          levelMap,
        });
      } else if (action === "reject") {
        await ratesApi.reject(ingestId);
      } else {
        if (supplierId) await ratesApi.assignSupplier(ingestId, supplierId);
        await ratesApi.process(ingestId);
      }
      onChanged();
      if (action === "process") setReloadKey((key) => key + 1);
      else onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido completar");
    } finally {
      setBusy(null);
    }
  };

  const ingest = detail?.ingest;
  return (
    <Sheet open={Boolean(ingestId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="!w-full sm:!w-[90vw] lg:!w-[80vw] !p-0 flex flex-col gap-0 overflow-hidden"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>
            {review && !bringsPrices && review.commissions.length > 0 ? "Revisar comisiones" : "Revisar precios"}
            {review ? ` · ${review.supplier.name}` : ""}
          </SheetTitle>
          <SheetDescription>
            {ingest ? (ingest.fileName ?? ingest.emailSubject ?? "Texto pegado") : ""}
            {!bringsPrices
              ? ""
              : review?.activeVersion
              ? ` · frente a la versión vigente desde ${formatDay(review.activeVersion.validFrom)}`
              : review
                ? " · primera versión de esta comercializadora"
                : ""}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-4">
            {detail?.originalUrl && (
              <a
                href={detail.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline w-fit"
              >
                Ver el original
              </a>
            )}
            {/* Una lectura pendiente se puede repetir: tras corregir el lector, o si la IA falló. */}
            {review && canDecide && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={busy !== null}
                onClick={() => run("process")}
              >
                {busy === "process" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Volver a leer
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {error && <p className="text-sm text-danger">{error}</p>}
          {negocoReviewing && (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-800">
              Negoco está revisando este anexo: se aplicará en cuanto esté revisado. No tenéis que hacer nada.
            </p>
          )}
          {ingest?.progress && (
            <p className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              Se han aplicado {ingest.progress.approvedRows} de {ingest.progress.totalRows} tarifas. Negoco está revisando el resto.
            </p>
          )}
          {ingest?.pendingReason && detail?.canManageCatalog && (
            <p className="text-sm text-warning-600">No se ha aprobado sola: {ingest.pendingReason}.</p>
          )}

          {ingest && !review && !loading && (
            <div className="space-y-3 text-sm">
              {ingest.status === "out_of_scope" && <p>Fuera de alcance: {ingest.reason}</p>}
              {ingest.status === "failed" && <p className="text-danger">Ha fallado: {ingest.error}</p>}
              {["received", "failed", "needs_review", "out_of_scope"].includes(ingest.status) && (
                <>
                  {!ingest.comercializadoraId && detail?.canManageCatalog && (
                    <div className="space-y-1 max-w-sm">
                      <Label htmlFor="ingest-supplier">¿De qué comercializadora es?</Label>
                      <select
                        id="ingest-supplier"
                        className="w-full rounded-md border px-2 py-1.5"
                        value={supplierId}
                        onChange={(event) => setSupplierId(event.target.value)}
                      >
                        <option value="">Elige una</option>
                        {activeSuppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {(ingest.status === "received" ? detail?.canManage : detail?.canManageCatalog) && (
                    <Button
                      variant="outline"
                      disabled={busy !== null || (!ingest.comercializadoraId && !supplierId)}
                      onClick={() => run("process")}
                    >
                      {busy === "process" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      {ingest.status === "received" ? "Leer precios" : "Volver a leer"}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {review && (
            <>
              <IssueList issues={review.issues} />

              {review.newProducts.length > 0 && (
                <p className="text-sm text-info-600">
                  Se darán de alta en el catálogo: {review.newProducts.join(", ")}.
                </p>
              )}

              {!bringsPrices && (
                <p className="text-sm">
                  {review.commissions.length > 0
                    ? `Este anexo solo trae comisiones: los precios de ${review.supplier.name} no cambian.`
                    : "Este documento no trae precios fijos ni indexados de 2.0TD ni de gas. El comparador solo guarda esas tarifas."}
                </p>
              )}

              {canDecide && bringsPrices && review.activeVersion && review.entries.some(({ kind }) => kind === "removed" || kind === "carried") && (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={partial}
                    onCheckedChange={(value) => {
                      const next = value === true;
                      setPartial(next);
                      void preview(excluded, regulated, next);
                    }}
                  />
                  <span>
                    Mantener las tarifas que no vienen en este anexo
                    <span className="block text-xs text-muted-foreground">
                      Márcalo si el anexo solo trae una parte (por ejemplo, una familia de productos). Si no, las que
                      no vienen se retiran.
                    </span>
                  </span>
                </label>
              )}

              {canDecide && missingPower.size > 0 && (
                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <p>
                    {missingPower.size === 1 ? "Una tarifa no trae" : `${missingPower.size} tarifas no traen`} la potencia.
                    Marca «Usar la regulada (BOE)» en cada fila o, si la comercializadora la da en otro documento,
                    indícala aquí para todas:
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="manual-p1">P1 (€/kW·año)</Label>
                      <Input
                        id="manual-p1"
                        inputMode="decimal"
                        className="w-28"
                        value={powerDraft.p1}
                        onChange={(event) => setPowerDraft((draft) => ({ ...draft, p1: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="manual-p2">P2 (€/kW·año)</Label>
                      <Input
                        id="manual-p2"
                        inputMode="decimal"
                        className="w-28"
                        value={powerDraft.p2}
                        onChange={(event) => setPowerDraft((draft) => ({ ...draft, p2: event.target.value }))}
                      />
                    </div>
                    <Button
                      variant="outline"
                      disabled={!(parseDecimal(powerDraft.p1) > 0) || !(parseDecimal(powerDraft.p2) >= 0) || busy !== null}
                      onClick={() => {
                        const typed = { p1: parseDecimal(powerDraft.p1), p2: parseDecimal(powerDraft.p2) };
                        const next = Object.fromEntries(
                          [...missingPower].filter((key) => !excluded.has(key)).map((key) => [key, typed]),
                        );
                        const nextRegulated = new Set([...regulated].filter((key) => !(key in next)));
                        setManualPower(next);
                        setRegulated(nextRegulated);
                        void preview(excluded, nextRegulated, partial, next);
                      }}
                    >
                      Aplicar a todas
                    </Button>
                    {Object.keys(manualPower).length > 0 && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setManualPower({});
                          void preview(excluded, regulated, partial, {});
                        }}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {bringsPrices && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Tarifa</TableHead>
                    <TableHead>Condiciones</TableHead>
                    <TableHead>Energía €/kWh (P1/P2/P3 · gas: variable)</TableHead>
                    <TableHead>Potencia €/kW·día (gas: fijo)</TableHead>
                    <TableHead>En el documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const rowKey = entry.rowKey;
                    const isExcluded = rowKey ? excluded.has(rowKey) : false;
                    const row = entry.proposed ?? entry.active!;
                    return (
                      <TableRow key={entry.key} className={isExcluded ? "opacity-40" : undefined}>
                        <TableCell>
                          {rowKey && canDecide && (
                            <Checkbox
                              aria-label={`Incluir ${entry.productName}`}
                              checked={!isExcluded}
                              onCheckedChange={() => {
                                const next = toggle(excluded, rowKey);
                                setExcluded(next);
                                void preview(next, regulated);
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.productName}</div>
                          <Badge variant={KIND_LABEL[entry.kind].variant}>{KIND_LABEL[entry.kind].label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.conditions.accessTariff !== "2.0TD" && <span className="font-medium">{entry.conditions.accessTariff} · </span>}
                          {describeConditions({ ...entry.conditions, ...row })}
                        </TableCell>
                        <TableCell className="text-sm">{energyCell(entry)}</TableCell>
                        <TableCell className="text-sm">
                          {rowKey && missingPower.has(rowKey) && canDecide && !manualPower[rowKey] ? (
                            <label className="flex items-center gap-2">
                              <Checkbox
                                checked={regulated.has(rowKey)}
                                onCheckedChange={() => {
                                  const next = toggle(regulated, rowKey);
                                  setRegulated(next);
                                  void preview(excluded, next);
                                }}
                              />
                              Usar la regulada (BOE)
                            </label>
                          ) : (
                            describePower({ ...row, accessTariff: entry.conditions.accessTariff })
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[320px]">
                          {entry.proposed?.sourceExcerpt ||
                            (entry.proposed && detail?.originalUrl ? (
                              <a href={detail.originalUrl} target="_blank" rel="noreferrer" className="underline">
                                Revisar en el original
                              </a>
                            ) : entry.proposed ? (
                              "Revisar en el original"
                            ) : (
                              ""
                            ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              )}

              {review.commissions.length > 0 && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={includeCommissions}
                      onCheckedChange={(value) => setIncludeCommissions(value === true)}
                      disabled={!canDecide}
                    />
                    Guardar las comisiones ({review.commissions.length} reglas)
                  </label>
                  {review.commissionLevels.length > 0 && (
                    <LevelMapping
                      choices={review.commissionLevels}
                      supplierName={review.supplier.name}
                      disabled={!canDecide || busy !== null}
                      onChange={(level, mappedTo) => {
                        const next = { ...levelMap, [level]: mappedTo };
                        setLevelMap(next);
                        void preview(excluded, regulated, partial, manualPower, next);
                      }}
                    />
                  )}
                  <CommissionGroups commissions={review.commissions} />
                </div>
              )}

              {(review.outOfScope.length > 0 || review.skipped.length > 0) && (
                <p className="text-xs text-muted-foreground">
                  No se guardan (fuera del comparador):{" "}
                  {[
                    ...review.skipped,
                    ...review.outOfScope.map(({ productName, pricing }) => `${productName} (${pricing})`),
                  ].join(", ")}
                </p>
              )}
            </>
          )}
        </div>

        {review && canDecide && (
          <div className="border-t px-6 py-4 flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="valid-from">{bringsPrices ? "Entra en vigor" : "Las comisiones valen desde"}</Label>
              <Input
                id="valid-from"
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
                className="w-44"
              />
            </div>
            <p className="text-xs text-muted-foreground flex-1">
              {bringsPrices
                ? validFrom > today()
                  ? "Los precios quedarán programados y entrarán en vigor ese día."
                  : review.activeVersion
                    ? "Los precios sustituirán desde ese día a los vigentes."
                    : "Serán los precios vigentes desde ese día."
                : ""}
              {savesCommissions &&
                `${bringsPrices ? " " : ""}Las comisiones de ${commissionEnergies(review.commissions)} que hay ahora dejan de valer el día anterior.`}
              {bringsPrices && review.entries.some(({ conditions }) => conditions.supplyStartFrom) &&
                " El mes de inicio de cada tarifa («si empieza en noviembre») es otra cosa: la fecha en que empieza el suministro del cliente."}
            </p>
            <Button variant="outline" disabled={busy !== null} onClick={() => run("reject")}>
              Descartar
            </Button>
            <Button
              disabled={busy !== null || blocking.length > 0 || !validFrom}
              onClick={() => run("approve")}
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {bringsPrices ? "Aprobar precios" : "Aprobar comisiones"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
