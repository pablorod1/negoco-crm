"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RotateCcw, Upload } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import {
  euros,
  kwh,
  studyApi,
  type ComparativaStudies,
  type StudyOfferView,
  type StudyOptionsInput,
  type StudyView,
} from "./api";

const TERRITORY: Record<string, string> = {
  peninsula: "Península",
  baleares: "Baleares",
  canarias: "Canarias",
  ceuta_melilla: "Ceuta y Melilla",
};

const POWER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  adequate: { label: "Potencia adecuada", tone: "success" },
  oversized: { label: "Potencia sobredimensionada", tone: "warning" },
  exceeded: { label: "La demanda supera la potencia", tone: "danger" },
};

/** «29,93» o «29.93» como número; null si está vacío o no lo es. */
const parseFee = (text: string) => {
  const value = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(value) && value >= 0 ? value : null;
};

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function offerConditions(offer: StudyOfferView) {
  return [
    offer.level,
    offer.segment,
    offer.termMonths ? `${offer.termMonths} meses` : null,
    offer.powerMode === "regulated" ? "potencia BOE" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Elegir la factura: un PDF adjunto a la comparativa o uno nuevo. */
function InvoicePicker({
  pdfs,
  busy,
  onAnalyze,
}: {
  pdfs: ComparativaStudies["pdfs"];
  busy: boolean;
  onAnalyze: (invoice: { fileId: string } | { file: File }) => void;
}) {
  const [fileId, setFileId] = useState(pdfs[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <p className="text-sm font-medium">Elige la factura de luz del cliente</p>
        <p className="text-xs text-muted-foreground">
          Se lee en el CRM y los datos personales se tapan antes de analizarla. El consumo de 12 meses y la potencia
          salen del SIPS cuando el CUPS está en la factura.
        </p>
      </div>
      {pdfs.length > 0 && (
        <div className="space-y-2">
          {pdfs.map((pdf) => (
            <label key={pdf.id} className="flex items-center gap-2 rounded-md border bg-white p-2 text-sm">
              <input
                type="radio"
                name="invoice"
                checked={!file && fileId === pdf.id}
                onChange={() => {
                  setFile(null);
                  setFileId(pdf.id);
                }}
              />
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{pdf.filename}</span>
            </label>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="study-invoice">{pdfs.length ? "O sube otra factura (PDF)" : "Sube la factura (PDF)"}</Label>
        <Input
          id="study-invoice"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>
      <Button
        disabled={busy || (!file && !fileId)}
        onClick={() => onAnalyze(file ? { file } : { fileId })}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Analizando la factura…" : "Analizar factura"}
      </Button>
      {busy && (
        <p className="text-xs text-muted-foreground">
          Suele tardar entre 15 y 40 segundos: lectura, extracción y consulta al SIPS.
        </p>
      )}
    </div>
  );
}

/** Resultado del estudio: suministro, lo que paga hoy y las ofertas. */
function StudyResult({
  study,
  busy,
  onOptions,
  onChoose,
  onRestart,
}: {
  study: StudyView;
  busy: boolean;
  onOptions: (options: StudyOptionsInput) => void;
  onChoose: (offer: StudyOfferView) => void;
  onRestart: () => void;
}) {
  const [feeText, setFeeText] = useState(
    study.options.feeEnergyPerMwh === null ? "" : String(study.options.feeEnergyPerMwh),
  );
  const supply = study.supply!;
  const annual = supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;
  const power = supply.power ? POWER_STATUS[supply.power.status] : null;
  const chosenKey = study.chosenOffer?.key ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {study.invoiceFileName} · {study.invoice?.supplierName ?? "Comercializadora sin identificar"}
          {study.invoice?.billingPeriod?.from
            ? ` · ${study.invoice.billingPeriod.from} a ${study.invoice.billingPeriod.to}`
            : ""}
        </p>
        <Button variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="h-3.5 w-3.5" />
          Analizar otra factura
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          label="Consumo anual"
          value={kwh(annual)}
          hint={`${supply.consumptionSource === "sips" ? `SIPS, ${supply.sipsMonths} meses` : "Factura llevada a un año"} · P1 ${kwh(supply.annualKwh.P1)} · P2 ${kwh(supply.annualKwh.P2)} · P3 ${kwh(supply.annualKwh.P3)}`}
        />
        <Fact
          label="Potencia contratada"
          value={`${supply.contractedKw.P1.toLocaleString("es-ES")} / ${supply.contractedKw.P2.toLocaleString("es-ES")} kW`}
          hint={
            supply.power
              ? `Máxima demanda ${supply.power.maxDemandKw.toLocaleString("es-ES")} kW`
              : "Sin máxima demanda (no hay SIPS)"
          }
        />
        <Fact
          label="Territorio"
          value={TERRITORY[supply.territory] ?? supply.territory}
          hint={supply.territorySource === "sips" ? "Según el SIPS" : "Sin SIPS: se da por Península"}
        />
        <Fact
          label="Hoy paga al año"
          value={euros(study.current?.total)}
          hint={study.current ? "Con sus precios actuales e impuestos" : "La factura no da todos sus precios"}
        />
      </div>

      {power && supply.power && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={power.tone}>{power.label}</Badge>
          {supply.power.status !== "adequate" && (
            <span className="text-muted-foreground">
              Sugerida: {supply.power.suggestedKw.toLocaleString("es-ES")} kW
            </span>
          )}
        </div>
      )}

      {study.issues.length > 0 && (
        <div className="space-y-1">
          {study.issues.some(({ severity }) => severity === "blocking") && (
            <p className="text-sm font-medium text-danger">
              La lectura de la factura no cuadra del todo: comprueba lo que paga hoy contra el PDF antes de proponer.
            </p>
          )}
          <ul className="space-y-1">
            {study.issues.map((issue, index) => (
              <li
                key={index}
                className={`flex gap-2 text-sm ${issue.severity === "blocking" ? "text-danger" : "text-warning-600"}`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <div className="space-y-1">
          <Label htmlFor="study-fee">Fee de energía (€/MWh)</Label>
          <Input
            id="study-fee"
            inputMode="decimal"
            className="w-36"
            placeholder="Mínimo de cada tarifa"
            value={feeText}
            onChange={(event) => setFeeText(event.target.value)}
            onBlur={() => onOptions({ feeEnergyPerMwh: parseFee(feeText) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="study-channel">Cliente</Label>
          <select
            id="study-channel"
            className="h-9 rounded-md border px-2 text-sm"
            value={study.options.channel ?? ""}
            onChange={(event) =>
              onOptions({ channel: (event.target.value || null) as StudyOptionsInput["channel"] })
            }
          >
            <option value="acquisition">Captación</option>
            <option value="renewal">Renovación</option>
            <option value="">Cualquiera</option>
          </select>
        </div>
        {study.showCommission && (
          <div className="space-y-1">
            <Label htmlFor="study-order">Ordenar por</Label>
            <select
              id="study-order"
              className="h-9 rounded-md border px-2 text-sm"
              value={study.options.order}
              onChange={(event) => onOptions({ order: event.target.value as "savings" | "commission" })}
            >
              <option value="savings">Ahorro del cliente</option>
              <option value="commission">Comisión</option>
            </select>
          </div>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin mb-2" />}
        <p className="text-xs text-muted-foreground ml-auto">
          {study.totalOffers} tarifas encajan · {study.ineligible} no encajan con este suministro
        </p>
      </div>

      {study.noSavings && (
        <p className="text-sm text-warning-600">
          Ninguna tarifa mejora lo que paga hoy. Mejor no proponer un cambio solo por precio.
        </p>
      )}

      {study.offers.length === 0 ? (
        <p className="text-sm">
          No hay tarifas cargadas que encajen con este suministro. Revisa los precios vigentes en Comercializadoras →
          Tarifas.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comercializadora</TableHead>
              <TableHead>Tarifa</TableHead>
              <TableHead className="text-right">Coste anual</TableHead>
              <TableHead className="text-right">Ahorro</TableHead>
              {study.showCommission && <TableHead className="text-right">Comisión</TableHead>}
              <TableHead className="text-right">Fee</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {study.offers.map((offer) => (
              <TableRow key={offer.key} className={offer.key === chosenKey ? "bg-success-50" : undefined}>
                <TableCell className="font-medium">{offer.comercializadoraName}</TableCell>
                <TableCell>
                  <div>{offer.productName}</div>
                  <div className="text-xs text-muted-foreground">{offerConditions(offer)}</div>
                  {offer.discounts.length > 0 && (
                    <div className="text-xs text-muted-foreground">{offer.discounts.join(" · ")}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">{euros(offer.cost.total)}</TableCell>
                <TableCell
                  className={`text-right font-medium ${offer.savings !== null && offer.savings > 0 ? "text-success-700" : "text-danger"}`}
                >
                  {euros(offer.savings)}
                </TableCell>
                {study.showCommission && (
                  <TableCell className="text-right">
                    {offer.commission === null ? <span className="text-muted-foreground">—</span> : euros(offer.commission)}
                  </TableCell>
                )}
                <TableCell className="text-right text-xs">
                  {offer.feeRange ? `${offer.feeEnergyPerMwh} €/MWh` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {offer.key === chosenKey ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3" /> Elegida
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => onChoose(offer)}>
                      Elegir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {study.chosenOffer && (
        <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm">
          Elegida: <strong>{study.chosenOffer.comercializadoraName} · {study.chosenOffer.productName}</strong> —{" "}
          {euros(study.chosenOffer.cost.total)} al año
          {study.chosenOffer.savings !== null ? `, ahorra ${euros(study.chosenOffer.savings)}` : ""}
          {study.showCommission && study.chosenOffer.commission !== null
            ? ` · comisión ${euros(study.chosenOffer.commission)}`
            : ""}
          . El PDF para el cliente y el cierre del estudio llegan en el siguiente paso.
        </div>
      )}
    </div>
  );
}

/** El estudio de una comparativa dentro del panel lateral. */
export function NegocoStudy({ comparativaId }: { comparativaId: string }) {
  const [list, setList] = useState<ComparativaStudies | null>(null);
  const [study, setStudy] = useState<StudyView | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewRequest = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await studyApi.list(comparativaId);
      setList(data);
      const latest = data.studies.find(({ status }) => status !== "failed");
      if (latest) setStudy(await studyApi.view(latest.id));
      else setPicking(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido cargar");
    }
  }, [comparativaId]);

  useEffect(() => {
    // Los cambios de estado llegan después de la respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const analyze = async (invoice: { fileId: string } | { file: File }) => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await studyApi.analyze(comparativaId, invoice);
      setStudy(await studyApi.view(id));
      setPicking(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido analizar la factura");
    } finally {
      setBusy(false);
    }
  };

  const changeOptions = async (options: StudyOptionsInput) => {
    if (!study) return;
    const requestId = ++viewRequest.current;
    setBusy(true);
    try {
      await studyApi.saveOptions(study.id, options);
      const next = await studyApi.view(study.id);
      if (requestId === viewRequest.current) setStudy(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido recalcular");
    } finally {
      if (requestId === viewRequest.current) setBusy(false);
    }
  };

  const choose = async (offer: StudyOfferView) => {
    if (!study) return;
    setBusy(true);
    try {
      setStudy(await studyApi.choose(study.id, offer.key, study.options));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido elegir la oferta");
    } finally {
      setBusy(false);
    }
  };

  if (!list && !error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {list && list.service !== "Luz" ? (
        <p className="text-sm">El comparador propio compara luz 2.0TD; esta comparativa es de gas.</p>
      ) : picking || !study ? (
        list && <InvoicePicker pdfs={list.pdfs} busy={busy} onAnalyze={analyze} />
      ) : (
        <StudyResult
          key={study.id}
          study={study}
          busy={busy}
          onOptions={changeOptions}
          onChoose={choose}
          onRestart={() => setPicking(true)}
        />
      )}
    </div>
  );
}
