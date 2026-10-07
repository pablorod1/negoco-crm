"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, FileUp, Loader2, Mail, Upload } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Switch } from "@/core/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import {
  describeConditions,
  describePower,
  formatDay,
  formatMoment,
  formatPrice,
  ratesApi,
  type IngestSummary,
  type SupplierRatesResponse,
} from "./api";
import { IngestReviewSheet } from "./IngestReviewSheet";
import { RateUploadDialog } from "./RateUploadDialog";

const INGEST_STATUS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" | "info" | "pending" }> = {
  received: { label: "Sin leer", variant: "pending" },
  processing: { label: "Leyendo", variant: "info" },
  ready: { label: "Lista para aprobar", variant: "success" },
  needs_review: { label: "Revisar", variant: "warning" },
  approved: { label: "Aprobada", variant: "default" },
  rejected: { label: "Descartada", variant: "default" },
  failed: { label: "Error", variant: "danger" },
  out_of_scope: { label: "Fuera de alcance", variant: "default" },
};

const VERSION_STATUS: Record<string, string> = {
  active: "Vigente",
  scheduled: "Programada",
  superseded: "Sustituida",
  discarded: "Descartada",
  draft: "Borrador",
};

function FreshnessBadge({ freshness }: { freshness: SupplierRatesResponse["freshness"] }) {
  if (freshness.status === "never") return <Badge variant="warning">Sin precios cargados</Badge>;
  if (freshness.status === "stale") {
    return (
      <Badge variant="danger">
        <AlertTriangle className="h-3 w-3" /> Sin actualizar desde hace {freshness.days} días
      </Badge>
    );
  }
  return <Badge variant="success">Actualizada {sinceDays(freshness.days)}</Badge>;
}

const sinceDays = (days: number | null) =>
  !days ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;

function energyText(energy: { P1: number; P2: number; P3: number } | null) {
  if (!energy) return "—";
  return energy.P1 === energy.P2 && energy.P2 === energy.P3
    ? formatPrice(energy.P1)
    : `${formatPrice(energy.P1)} / ${formatPrice(energy.P2)} / ${formatPrice(energy.P3)}`;
}

/**
 * Vista «Tarifas» de una comercializadora: precios vigentes, anexos
 * recibidos, historial de versiones, comisiones y tarifas del catálogo.
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
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No se han podido cargar las tarifas");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [comercializadoraId, reloadKey]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <Loader2 className="h-5 w-5 animate-spin" />;

  const pending = data.ingests.filter(({ status }) =>
    ["received", "processing", "ready", "needs_review", "failed"].includes(status),
  );

  const toggleRate = async (rateId: string, enabled: boolean) => {
    await ratesApi.toggleRate(rateId, comercializadoraId, enabled);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FreshnessBadge freshness={data.freshness} />
        {data.medianDecisionHours !== null && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            De la llegada a la aprobación: {data.medianDecisionHours} h (mediana; objetivo &lt; 24 h)
          </span>
        )}
        <div className="flex-1" />
        {data.canManage && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Subir anexo
          </Button>
        )}
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anexos pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <IngestList ingests={pending} onOpen={setReviewing} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Precios vigentes
            {data.activeVersion &&
              ` · desde ${formatDay(data.activeVersion.validFrom)}${data.activeVersion.validTo ? ` hasta ${formatDay(data.activeVersion.validTo)}` : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.activePrices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay precios aprobados. Sube el anexo vigente de la comercializadora.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarifa</TableHead>
                  <TableHead>Condiciones</TableHead>
                  <TableHead>Energía €/kWh (P1/P2/P3)</TableHead>
                  <TableHead>Potencia €/kW·día (P1/P2)</TableHead>
                  <TableHead>Descuentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activePrices.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.rateName}</TableCell>
                    <TableCell className="text-sm">{describeConditions(row)}</TableCell>
                    <TableCell className="text-sm">{energyText(row.energy)}</TableCell>
                    <TableCell className="text-sm">{describePower(row)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.discounts.map(({ text, conditional }) => `${text}${conditional ? " (condicionado)" : ""}`).join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.commissionRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comisiones</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Consumo anual</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Vigencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.commissionRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="text-sm">
                      {[rule.accessTariff, rule.level, rule.channel === "renewal" ? "Renovación" : rule.channel ? "Captación" : null]
                        .filter(Boolean)
                        .join(" · ") || "Todas las tarifas"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.minAnnualKwh === null && rule.maxAnnualKwh === null
                        ? "Cualquiera"
                        : `${(rule.minAnnualKwh ?? 0) / 1000}–${rule.maxAnnualKwh === null ? "∞" : rule.maxAnnualKwh / 1000} MWh`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.ruleType === "fixed"
                        ? `${rule.amount} €`
                        : rule.ruleType === "per_mwh"
                          ? `${rule.amount} €/MWh`
                          : `${rule.amount} % del fee`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDay(rule.validFrom)}
                      {rule.validTo ? ` → ${rule.validTo}` : " → vigente"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tarifas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                El catálogo no tiene tarifas de esta comercializadora. Se dan de alta al aprobar su primer anexo.
              </p>
            )}
            {data.rates.map((rate) => (
              <div key={rate.catalogRateId ?? rate.rateId} className="flex items-center gap-3 text-sm">
                <span className="flex-1 font-medium">{rate.name}</span>
                <span className="text-muted-foreground">
                  {rate.activeRows ? `${rate.activeRows} filas vigentes` : "sin precios"}
                </span>
                {rate.rateId && data.canManage && (
                  <Switch
                    aria-label={`Ofrecer ${rate.name}`}
                    checked={rate.enabled}
                    onCheckedChange={(value) => void toggleRate(rate.rateId!, value)}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.versions.map((version) => (
              <div key={version.id} className="flex items-center gap-3 text-sm">
                <Badge variant={version.status === "active" ? "success" : version.status === "scheduled" ? "info" : "default"}>
                  {VERSION_STATUS[version.status]}
                </Badge>
                <span className="flex-1">
                  {formatDay(version.validFrom)}
                  {version.validTo ? ` → ${version.validTo}` : ""}
                </span>
                {version.status === "scheduled" && data.canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await ratesApi.discardVersion(version.id, comercializadoraId);
                      load();
                    }}
                  >
                    Descartar
                  </Button>
                )}
              </div>
            ))}
            <IngestList
              ingests={data.ingests.filter(({ status }) => ["approved", "rejected", "out_of_scope"].includes(status))}
              onOpen={setReviewing}
            />
          </CardContent>
        </Card>
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

function IngestList({ ingests, onOpen }: { ingests: IngestSummary[]; onOpen: (id: string) => void }) {
  if (ingests.length === 0) return null;
  return (
    <ul className="divide-y">
      {ingests.map((ingest) => (
        <li key={ingest.id}>
          <button
            type="button"
            className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-muted/50"
            onClick={() => onOpen(ingest.id)}
          >
            {ingest.channel === "email" ? <Mail className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
            <span className="flex-1 truncate">
              {ingest.fileName ?? ingest.emailSubject ?? "Texto pegado"}
              <span className="text-muted-foreground"> · {formatMoment(ingest.receivedAt)}</span>
            </span>
            <Badge variant={INGEST_STATUS[ingest.status]?.variant ?? "default"}>
              {INGEST_STATUS[ingest.status]?.label ?? ingest.status}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}
