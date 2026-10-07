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
  const visible = issues.filter(({ severity }) => severity !== "info");
  if (visible.length === 0) return null;
  return (
    <ul className="space-y-1">
      {visible.map((issue, index) => (
        <li
          key={`${issue.code}-${index}`}
          className={`flex gap-2 text-sm ${issue.severity === "blocking" ? "text-danger" : "text-warning-600"}`}
        >
          {issue.severity === "blocking" ? (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          {issue.message}
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
  const [validFrom, setValidFrom] = useState(today());
  const [includeCommissions, setIncludeCommissions] = useState(true);
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
        setValidFrom(data.review?.validFrom ?? today());
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
  ) => {
    if (!ingestId) return;
    const requestId = ++previewRequest.current;
    setBusy("preview");
    try {
      const data = await ratesApi.preview(ingestId, {
        excludedRowKeys: [...nextExcluded],
        regulatedPowerRowKeys: [...nextRegulated],
        partialUpdate: nextPartial,
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

  const blocking = (review?.issues ?? []).filter(({ severity }) => severity === "blocking");
  const canDecide = detail?.canManage && ["ready", "needs_review"].includes(detail.ingest.status);
  const newProductsBlocked = Boolean(review?.newProducts.length) && !detail?.canManageCatalog;

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
          partialUpdate: partial,
          includeCommissions,
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
          <SheetTitle>Revisar precios{review ? ` · ${review.supplier.name}` : ""}</SheetTitle>
          <SheetDescription>
            {ingest ? (ingest.fileName ?? ingest.emailSubject ?? "Texto pegado") : ""}
            {review?.activeVersion
              ? ` · frente a la versión vigente desde ${formatDay(review.activeVersion.validFrom)}`
              : review
                ? " · primera versión de esta comercializadora"
                : ""}
          </SheetDescription>
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
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {error && <p className="text-sm text-danger">{error}</p>}

          {ingest && !review && !loading && (
            <div className="space-y-3 text-sm">
              {ingest.status === "out_of_scope" && <p>Fuera de alcance: {ingest.reason}</p>}
              {ingest.status === "failed" && <p className="text-danger">Ha fallado: {ingest.error}</p>}
              {["received", "failed", "needs_review", "out_of_scope"].includes(ingest.status) && (
                <>
                  {!ingest.comercializadoraId && (
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
                  {detail?.canManage && (
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
                <p className={`text-sm ${newProductsBlocked ? "text-danger" : "text-info-600"}`}>
                  {newProductsBlocked
                    ? `No están en el catálogo y solo Negoco puede darlos de alta: ${review.newProducts.join(", ")}. Exclúyelos para aprobar el resto.`
                    : `Se darán de alta en el catálogo: ${review.newProducts.join(", ")}.`}
                </p>
              )}

              {entries.length === 0 && (
                <p className="text-sm">
                  Este documento no trae precios fijos de 2.0TD
                  {review.commissions.length > 0 ? "; solo comisiones." : "."} La v1 del comparador solo
                  guarda esas tarifas.
                </p>
              )}

              {canDecide && review.activeVersion && review.entries.some(({ kind }) => kind === "removed" || kind === "carried") && (
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

              {entries.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Tarifa</TableHead>
                    <TableHead>Condiciones</TableHead>
                    <TableHead>Energía €/kWh (P1/P2/P3)</TableHead>
                    <TableHead>Potencia €/kW·día</TableHead>
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
                          {describeConditions({ ...entry.conditions, ...row })}
                        </TableCell>
                        <TableCell className="text-sm">{energyCell(entry)}</TableCell>
                        <TableCell className="text-sm">
                          {rowKey && missingPower.has(rowKey) && canDecide ? (
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
                            describePower(row)
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
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={includeCommissions}
                      onCheckedChange={(value) => setIncludeCommissions(value === true)}
                      disabled={!canDecide}
                    />
                    Guardar las comisiones ({review.commissions.length} reglas)
                  </label>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {review.commissions.map((rule, index) => (
                      <li key={index}>
                        {[rule.productName, rule.accessTariff, rule.level].filter(Boolean).join(" · ") || "Todas"}
                        {rule.minAnnualKwh !== null || rule.maxAnnualKwh !== null
                          ? ` · ${rule.minAnnualKwh ?? 0}–${rule.maxAnnualKwh ?? "∞"} kWh`
                          : ""}
                        {" → "}
                        {rule.ruleType === "fixed"
                          ? `${rule.amount} €`
                          : rule.ruleType === "per_mwh"
                            ? `${rule.amount} €/MWh`
                            : `${rule.amount} % del fee`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(review.outOfScope.length > 0 || review.skipped.length > 0) && (
                <p className="text-xs text-muted-foreground">
                  No se guardan (fuera de la v1):{" "}
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
              <Label htmlFor="valid-from">Entra en vigor</Label>
              <Input
                id="valid-from"
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
                className="w-44"
              />
            </div>
            <p className="text-xs text-muted-foreground flex-1">
              {validFrom > today()
                ? "Quedará programada y entrará en vigor ese día."
                : review.activeVersion
                  ? "Sustituirá desde hoy a la versión vigente."
                  : "Será la versión vigente desde hoy."}
            </p>
            <Button variant="outline" disabled={busy !== null} onClick={() => run("reject")}>
              Descartar
            </Button>
            <Button
              disabled={busy !== null || blocking.length > 0 || newProductsBlocked || !validFrom}
              onClick={() => run("approve")}
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aprobar precios
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
