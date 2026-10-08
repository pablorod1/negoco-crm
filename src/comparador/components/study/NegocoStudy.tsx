"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, RotateCcw, Upload } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
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
  type ProposalView,
  type StudyOfferView,
  type StudyOptionsInput,
  type StudyView,
} from "./api";
import type { StudyClientDataInput } from "@/comparador/study/client-data";

type ClientForm = Record<keyof StudyClientDataInput, string>;

const CLIENT_FIELDS: { key: keyof StudyClientDataInput; label: string; wide?: boolean; placeholder?: string }[] = [
  { key: "name", label: "Nombre o razón social" },
  { key: "lastName", label: "Apellidos" },
  { key: "documentNumber", label: "DNI o CIF" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo", wide: true },
  { key: "iban", label: "IBAN", wide: true, placeholder: "ES00 0000 0000 0000 0000 0000" },
  { key: "address", label: "Dirección del suministro", wide: true },
  { key: "postalCode", label: "Código postal" },
  { key: "city", label: "Población" },
  { key: "province", label: "Provincia" },
];

/** Lo que se sabe del cliente antes de preguntar: el nombre de la comparativa y dónde está el suministro (SIPS). */
function initialClient(clientName: string | null, study: StudyView): ClientForm {
  const location = study.supply?.location ?? null;
  return {
    name: clientName ?? "",
    lastName: "",
    kind: "Particular",
    documentNumber: "",
    email: "",
    phone: "",
    iban: "",
    address: "",
    postalCode: location?.postalCode ?? "",
    city: location?.municipality ?? "",
    province: location?.province ?? "",
  };
}

/** Solo se envía lo que se ha escrito. */
function clientPayload(form: ClientForm): StudyClientDataInput | null {
  const entries = Object.entries(form).filter(([key, value]) => key !== "kind" && value.trim());
  if (entries.length === 0) return null;
  return { ...Object.fromEntries(entries), kind: form.kind === "Empresa" ? "Empresa" : "Particular" };
}

/** Datos del cliente, todos opcionales: rellenan el trámite al convertir la comparativa. */
function ClientFields({ form, onChange }: { form: ClientForm; onChange: (form: ClientForm) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm">
        {(["Particular", "Empresa"] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-1.5">
            <input type="radio" name="client-kind" checked={form.kind === kind} onChange={() => onChange({ ...form, kind })} />
            {kind}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CLIENT_FIELDS.map(({ key, label, wide, placeholder }) => (
          <div key={key} className={`space-y-1 ${wide ? "col-span-2" : ""}`}>
            <Label htmlFor={`client-${key}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`client-${key}`}
              className="h-8"
              placeholder={placeholder}
              value={form[key]}
              onChange={(event) => onChange({ ...form, [key]: event.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

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

/** La propuesta ya generada para esta oferta con este fee, si la hay. */
const proposalFor = (proposals: readonly ProposalView[], offer: StudyOfferView) =>
  proposals.find(
    (proposal) =>
      proposal.offerKey === offer.key &&
      proposal.feeEnergyPerMwh === offer.feeEnergyPerMwh &&
      proposal.annualTotal === offer.cost.total,
  );

/** Al completar: con qué propuesta se queda, de las generadas. */
function CompleteDialog({
  proposals,
  initial,
  open,
  onOpenChange,
  onComplete,
}: {
  proposals: ProposalView[];
  initial: ClientForm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (proposalId: string, client: StudyClientDataInput | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState(proposals.at(-1)?.id ?? "");
  const [client, setClient] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onComplete(selected, clientPayload(client));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido completar el estudio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿Con qué propuesta te quedas?</DialogTitle>
          <DialogDescription>
            Su PDF se guarda en los documentos de la comparativa, y la comparativa pasa a «Pendiente de revisión» con
            esa comercializadora y su comisión.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {proposals.map((proposal) => (
            <label
              key={proposal.id}
              className="flex items-start gap-3 rounded-md border bg-white p-3 text-sm has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="final-proposal"
                className="mt-1"
                checked={selected === proposal.id}
                onChange={() => setSelected(proposal.id)}
              />
              <span className="flex-1">
                <span className="font-medium">
                  Propuesta {proposal.number} · {proposal.comercializadoraName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {proposal.productName} · {euros(proposal.annualTotal)} al año
                  {proposal.savings !== null ? ` · ahorra ${euros(proposal.savings)}` : ""}
                </span>
              </span>
              <a
                href={proposal.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Ver PDF
              </a>
            </label>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3">
          <div>
            <p className="text-sm font-medium">Datos del cliente (opcionales)</p>
            <p className="text-xs text-muted-foreground">
              Rellenan el trámite al convertir la comparativa; lo que falte se pide entonces.
            </p>
          </div>
          <ClientFields form={client} onChange={setClient} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving || !selected} onClick={submit}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Completando…" : "Completar estudio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Las propuestas generadas, con su PDF, y el botón de completar el estudio. */
function Proposals({
  study,
  clientName,
  onComplete,
}: {
  study: StudyView;
  clientName: string | null;
  onComplete: (proposalId: string, client: StudyClientDataInput | null) => Promise<void>;
}) {
  const [completing, setCompleting] = useState(false);
  const closed = study.status === "closed";

  if (study.proposals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Pulsa «Ver PDF» en una tarifa para ver la propuesta que recibiría el cliente. Puedes generar todas las que
        quieras y, al completar el estudio, eliges con cuál te quedas.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Propuestas generadas ({study.proposals.length})</p>
        {!closed && (
          <Button size="sm" onClick={() => setCompleting(true)}>
            <CheckCircle2 className="h-4 w-4" />
            Completar estudio
          </Button>
        )}
      </div>
      <ul className="divide-y text-sm">
        {study.proposals.map((proposal) => (
          <li key={proposal.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
            <span className="w-24 shrink-0 text-muted-foreground">Propuesta {proposal.number}</span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{proposal.comercializadoraName}</span> · {proposal.productName}
              {proposal.chosen && (
                <Badge variant="success" className="ml-2">
                  Elegida
                </Badge>
              )}
            </span>
            <span>{euros(proposal.annualTotal)}/año</span>
            <span className={proposal.savings !== null && proposal.savings > 0 ? "text-success-700" : "text-danger"}>
              {proposal.savings !== null ? `ahorra ${euros(proposal.savings)}` : "—"}
            </span>
            {study.showCommission && (
              <span className="text-muted-foreground">
                comisión {proposal.commission === null ? "—" : euros(proposal.commission)}
              </span>
            )}
            <a
              href={proposal.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir PDF
            </a>
          </li>
        ))}
      </ul>
      {completing && (
        <CompleteDialog
          proposals={study.proposals}
          initial={initialClient(clientName, study)}
          open={completing}
          onOpenChange={setCompleting}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}

/** Resultado del estudio: suministro, lo que paga hoy y las ofertas. */
function StudyResult({
  study,
  busy,
  proposing,
  onOptions,
  onPropose,
  onComplete,
  onRestart,
  clientName,
}: {
  study: StudyView;
  busy: boolean;
  /** La oferta cuya propuesta se está generando. */
  proposing: string | null;
  onOptions: (options: StudyOptionsInput) => void;
  onPropose: (offer: StudyOfferView, options: StudyOptionsInput) => void;
  onComplete: (proposalId: string, client: StudyClientDataInput | null) => Promise<void>;
  onRestart: () => void;
  clientName: string | null;
}) {
  const [feeText, setFeeText] = useState(
    study.options.feeEnergyPerMwh === null ? "" : String(study.options.feeEnergyPerMwh),
  );
  const supply = study.supply!;
  const annual = supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;
  const power = supply.power ? POWER_STATUS[supply.power.status] : null;
  const closed = study.status === "closed";
  const chosen = study.proposals.find(({ chosen }) => chosen);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {study.invoiceFileName} · {study.invoice?.supplierName ?? "Comercializadora sin identificar"}
          {study.invoice?.billingPeriod?.from
            ? ` · ${study.invoice.billingPeriod.from} a ${study.invoice.billingPeriod.to}`
            : ""}
        </p>
        {!closed && (
          <Button variant="ghost" size="sm" onClick={onRestart}>
            <RotateCcw className="h-3.5 w-3.5" />
            Analizar otra factura
          </Button>
        )}
      </div>

      {closed && (
        <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm">
          Estudio completado
          {chosen ? ` con la propuesta ${chosen.number} (${chosen.comercializadoraName} · ${chosen.productName})` : ""}.
          Su PDF está en los documentos de la comparativa.
        </div>
      )}

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

      <Proposals study={study} clientName={clientName} onComplete={onComplete} />

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
            {study.offers.map((offer) => {
              const proposal = proposalFor(study.proposals, offer);
              return (
              <TableRow key={offer.key} className={proposal ? "bg-primary-50" : undefined}>
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
                  {!closed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="whitespace-nowrap"
                      disabled={proposing !== null}
                      onClick={() => onPropose(offer, { feeEnergyPerMwh: parseFee(feeText) })}
                    >
                      {proposing === offer.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      {proposal ? `Propuesta ${proposal.number}` : "Ver PDF"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** El estudio de una comparativa dentro del panel lateral. */
export function NegocoStudy({
  comparativaId,
  onCompleted,
}: {
  comparativaId: string;
  /** Tras completar el estudio: la comparativa ha cambiado de estado y de documentos. */
  onCompleted?: () => void;
}) {
  const [list, setList] = useState<ComparativaStudies | null>(null);
  const [study, setStudy] = useState<StudyView | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proposing, setProposing] = useState<string | null>(null);
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

  /**
   * Genera la propuesta de una oferta y abre su PDF en otra pestaña. La
   * pestaña se abre en el mismo clic, antes de esperar al servidor: si se
   * abriera después, el navegador la bloquearía como ventana emergente.
   */
  const propose = async (offer: StudyOfferView, options: StudyOptionsInput) => {
    if (!study) return;
    const tab = window.open("", "_blank");
    try {
      if (tab) {
        tab.document.title = "Generando la propuesta…";
        tab.document.body.textContent = "Generando la propuesta…";
      }
    } catch {
      // Solo es el aviso mientras carga.
    }
    setProposing(offer.key);
    setError(null);
    try {
      const proposal = await studyApi.propose(study.id, offer.key, { ...study.options, ...options });
      if (tab) tab.location.href = proposal.pdfUrl;
      else setError("El navegador ha bloqueado la pestaña nueva: abre el PDF desde «Propuestas generadas».");
      setStudy((current) =>
        current?.id === study.id
          ? {
              ...current,
              proposals: [...current.proposals.filter(({ id }) => id !== proposal.id), proposal].sort(
                (left, right) => left.number - right.number,
              ),
            }
          : current,
      );
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : "No se ha podido generar la propuesta");
    } finally {
      setProposing(null);
    }
  };

  /** Completa el estudio con la propuesta elegida. Los errores los enseña el diálogo. */
  const complete = async (proposalId: string, client: StudyClientDataInput | null) => {
    if (!study) return;
    await studyApi.close(study.id, proposalId, client);
    setStudy(await studyApi.view(study.id));
    showCustomToast({
      title: "Estudio completado",
      message: "El PDF está en los documentos y la comparativa, pendiente de revisión.",
      icon: CheckCircle2,
      iconColor: "var(--success-color)",
    });
    onCompleted?.();
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
          proposing={proposing}
          onOptions={changeOptions}
          onPropose={propose}
          onComplete={complete}
          clientName={list?.clientName ?? null}
          onRestart={() => setPicking(true)}
        />
      )}
    </div>
  );
}
