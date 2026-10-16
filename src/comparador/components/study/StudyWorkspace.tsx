"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useTransitionRouter } from "next-view-transitions";
import { ArrowLeft, CheckCircle2, Columns3, FileText, Loader2, RotateCcw } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { Button } from "@/core/components/ui/button";
import { Skeleton } from "@/core/components/ui/skeleton";
import type { StudyClientDataInput } from "@/comparador/study/client-data";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import { studyApi, StudyRequestError, type ComparativaStudies, type StudyOfferView, type StudyOptionsInput, type StudyView } from "./api";
import { CompleteDialog, initialClient } from "./CompleteDialog";
import { CurrentTariffNote } from "./CurrentTariffNote";
import { InvoiceEditor } from "./InvoiceEditor";
import { InvoicePicker } from "./InvoicePicker";
import { OfferList } from "./OfferList";
import { OfferInsights } from "./OfferInsights";
import { FloatingBar, ProposalDock } from "./ProposalDock";
import { SavingsHero } from "./SavingsHero";
import { StudyFilters, parseFee, type SupplierFacet } from "./StudyFilters";
import { StudySidebar } from "./StudySidebar";
import { StudySteps, studyStep } from "./StudySteps";

/** La oferta que más ahorra; sin lo que paga hoy, la más barata. */
function bestOffer(all: readonly StudyOfferView[], hasCurrent: boolean): StudyOfferView | null {
  // Una tarifa sin los SSAA que necesita no compite en igualdad: no es «la mejor».
  const offers = all.filter(({ needsAncillary }) => !needsAncillary);
  if (offers.length === 0) return null;
  if (!hasCurrent) return offers.reduce((best, offer) => (offer.cost.total < best.cost.total ? offer : best));
  return offers.reduce((best, offer) => ((offer.savings ?? -Infinity) > (best.savings ?? -Infinity) ? offer : best));
}

/** Las comercializadoras del ranking, con cuántas tarifas trae cada una. */
function supplierFacets(offers: readonly StudyOfferView[]): SupplierFacet[] {
  const facets = new Map<string, SupplierFacet>();
  for (const offer of offers) {
    const facet = facets.get(offer.comercializadoraId);
    if (facet) facet.offers += 1;
    else facets.set(offer.comercializadoraId, { id: offer.comercializadoraId, name: offer.comercializadoraName, logo: offer.comercializadoraLogo, offers: 1 });
  }
  return [...facets.values()];
}

/** El hueco del resultado mientras carga: misma forma, sin saltos. */
function ResultSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

/** Resultado del estudio: la decisión arriba, el mapa y las ofertas, y al lado el suministro y las propuestas. */
function StudyResult({
  study,
  invoices,
  busy,
  proposing,
  clientName,
  onOptions,
  onPropose,
  onComplete,
  onReviewInvoice,
}: {
  study: StudyView;
  invoices: ComparativaStudies["invoices"];
  busy: boolean;
  proposing: string | null;
  clientName: string | null;
  onOptions: (options: StudyOptionsInput) => void;
  onPropose: (offer: StudyOfferView, options: StudyOptionsInput, alternatives?: StudyOfferView[]) => void;
  onComplete: (proposalId: string, client: StudyClientDataInput | null) => Promise<void>;
  onReviewInvoice: (invoice: InvoiceExtraction, acceptMismatch: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [feeText, setFeeText] = useState(study.options.feeEnergyPerMwh === null ? "" : String(study.options.feeEnergyPerMwh));
  const [powerFeeText, setPowerFeeText] = useState(study.options.feePowerPerKwYear ? String(study.options.feePowerPerKwYear) : "");
  const [completing, setCompleting] = useState(false);
  const [suppliers, setSuppliers] = useState<ReadonlySet<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const proposalsRef = useRef<HTMLDivElement>(null);
  const invoiceFile = invoices.find(({ id }) => id === study.invoiceFileId) ?? null;
  const closed = study.status === "closed";
  const hasCurrent = study.current !== null;

  const facets = useMemo(() => supplierFacets(study.offers), [study.offers]);
  const offers = useMemo(
    () => (suppliers.size === 0 ? study.offers : study.offers.filter(({ comercializadoraId }) => suppliers.has(comercializadoraId))),
    [study.offers, suppliers],
  );
  const best = bestOffer(study.offers, hasCurrent);
  const feeOptions = { feeEnergyPerMwh: parseFee(feeText), feePowerPerKwYear: parseFee(powerFeeText) };
  // Las ofertas a comparar en el orden del ranking: la primera es la principal.
  const comparing = study.offers.filter(({ key }) => compareKeys.includes(key));
  const proposalKeys = useMemo(() => new Set(study.proposals.map(({ offerKey }) => offerKey)), [study.proposals]);
  const maxSavings = Math.max(0, ...offers.map(({ savings }) => savings ?? 0));

  const toggleSupplier = (id: string) =>
    setSuppliers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <SavingsHero study={study} onReview={() => setEditing(true)} best={best && (!hasCurrent || (best.savings ?? 0) > 0) ? best : null} />
        <CurrentTariffNote study={study} />
        {!closed && (
          <StudyFilters
            study={study}
            busy={busy}
            feeText={feeText}
            onFeeText={setFeeText}
            powerFeeText={powerFeeText}
            onPowerFeeText={setPowerFeeText}
            onOptions={onOptions}
            suppliers={facets}
            selected={suppliers}
            onToggleSupplier={toggleSupplier}
            onClearSuppliers={() => setSuppliers(new Set())}
          />
        )}
        {offers.length > 1 && (
          <OfferInsights
            offers={offers}
            hasCurrent={hasCurrent}
            showCommission={study.showCommission}
            proposalKeys={proposalKeys}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
        )}
        <OfferList
          offers={offers}
          context={{
            study,
            // Quien puede ver comisiones las ve siempre: «—» y el motivo si falta.
            withCommission: study.showCommission,
            bestKey: best && (!hasCurrent || (best.savings ?? 0) > 0) ? best.key : null,
            maxSavings,
            selectedKey,
            proposing,
            onPropose: (offer) => onPropose(offer, feeOptions),
            compareKeys,
            onToggleCompare: (offer) =>
              setCompareKeys((keys) =>
                keys.includes(offer.key) ? keys.filter((key) => key !== offer.key) : keys.length >= 3 ? keys : [...keys, offer.key],
              ),
            onToggleDiscount: (id, applied) => {
              // La oferta puede cambiar de puesto: queda seleccionada para no perderla de vista.
              setSelectedKey(id.slice(0, id.lastIndexOf(":")));
              const excluded = new Set(study.options.excludedDiscounts ?? []);
              if (applied) excluded.delete(id);
              else excluded.add(id);
              onOptions({ excludedDiscounts: [...excluded] });
            },
          }}
        />
        {comparing.length === 0 && (
          <ProposalDock study={study} anchor={proposalsRef} onComplete={() => setCompleting(true)} />
        )}
        {!closed && comparing.length > 0 && (
          <FloatingBar>
            <Columns3 className="size-4 shrink-0 text-gray-300" />
            <p className="min-w-0 flex-1 basis-60">
              {comparing.length === 1
                ? "Marca otra oferta para compararlas en la misma propuesta (hasta tres)."
                : `${comparing.length} ofertas en una propuesta: la principal es ${comparing[0].comercializadoraName}, la de más ahorro.`}
            </p>
            <button type="button" onClick={() => setCompareKeys([])} className="ml-auto text-xs text-gray-300 hover:text-white">
              Quitar
            </button>
            <Button
              size="sm"
              className="rounded-lg"
              disabled={comparing.length < 2 || proposing !== null}
              onClick={() => {
                onPropose(comparing[0], feeOptions, comparing.slice(1));
                setCompareKeys([]);
              }}
            >
              {proposing === comparing[0]?.key ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
              Crear propuesta comparativa
            </Button>
          </FloatingBar>
        )}
      </div>

      <StudySidebar study={study} onComplete={() => setCompleting(true)} proposalsRef={proposalsRef}
        invoiceFile={invoiceFile}
        onReviewInvoice={() => setEditing(true)}
      />
      {editing && study.extraction && (
        <InvoiceEditor
          open={editing}
          onOpenChange={setEditing}
          initial={study.extraction}
          file={invoiceFile}
          required={study.invoiceReview.required}
          onSave={async (invoice, acceptMismatch) => {
            await onReviewInvoice(invoice, acceptMismatch);
            setEditing(false);
          }}
        />
      )}

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

/** La vista completa del estudio de una comparativa. */
export function StudyWorkspace({ comparativaId }: { comparativaId: string }) {
  const router = useTransitionRouter();
  const [list, setList] = useState<ComparativaStudies | null>(null);
  const [study, setStudy] = useState<StudyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proposing, setProposing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** La factura no trae un CUPS legible: se pide en el propio paso de la factura. */
  const [cupsPrompt, setCupsPrompt] = useState<string | null>(null);
  const viewRequest = useRef(0);
  const comparativaHref = `/comparativas/${comparativaId}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await studyApi.list(comparativaId);
      const latest = data.studies.find(({ status }) => status !== "failed");
      // El estudio se pide antes de pintar nada: sin él, el paso de factura parpadearía.
      const view = latest ? await studyApi.view(latest.id) : null;
      setList(data);
      setStudy(view);
      setPicking(!view);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido cargar");
    } finally {
      setLoading(false);
    }
  }, [comparativaId]);

  useEffect(() => {
    // Los cambios de estado llegan después de la respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const analyze = async (invoice: { fileId: string } | { files: File[] }, cups?: string, withoutSips = false) => {
    setBusy(true);
    setError(null);
    setCupsPrompt(null);
    try {
      const { id } = await studyApi.analyze(comparativaId, invoice, cups, withoutSips);
      setStudy(await studyApi.view(id));
      setPicking(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se ha podido analizar la factura";
      if (cause instanceof StudyRequestError && cause.code === "cups_missing") setCupsPrompt(message);
      else setError(message);
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
  const propose = async (offer: StudyOfferView, options: StudyOptionsInput, alternatives: StudyOfferView[] = []) => {
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
      const proposal = await studyApi.propose(
        study.id,
        offer.key,
        { ...study.options, ...options },
        alternatives.map(({ key }) => key),
      );
      if (tab) tab.location.href = proposal.pdfUrl;
      else setError("El navegador ha bloqueado la pestaña nueva: abre el PDF desde «Propuestas».");
      setStudy((current) =>
        current?.id === study.id
          ? {
              ...current,
              proposals: [...current.proposals.filter(({ id }) => id !== proposal.id), proposal].sort((left, right) => left.number - right.number),
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

  /** Guarda la factura revisada y recalcula lo que paga hoy y el ahorro. */
  const reviewInvoice = async (invoice: InvoiceExtraction, acceptMismatch: boolean) => {
    if (!study) return;
    await studyApi.reviewInvoice(study.id, invoice, acceptMismatch);
    setStudy(await studyApi.view(study.id));
    showCustomToast({
      title: "Factura revisada",
      message: "Lo que paga hoy y el ahorro se han recalculado con los datos revisados.",
      icon: CheckCircle2,
      iconColor: "var(--success-color)",
    });
  };

  /** Completa el estudio y vuelve a la comparativa, que ya está pendiente de revisión. */
  const complete = async (proposalId: string, client: StudyClientDataInput | null) => {
    if (!study) return;
    await studyApi.close(study.id, proposalId, client);
    showCustomToast({
      title: "Estudio completado",
      message: "El PDF está en los documentos y la comparativa, pendiente de revisión.",
      icon: CheckCircle2,
      iconColor: "var(--success-color)",
    });
    router.push(comparativaHref);
  };

  const showPicker = picking || !study;
  const isGas = list?.service === "Gas";

  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="size-9 shrink-0 rounded-xl ring-1 ring-gray-200">
            <Link href={comparativaHref} aria-label="Volver a la comparativa">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Estudio Negoco Cloud · {isGas ? "gas natural" : "luz 2.0TD"}</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-48" />
            ) : (
              <h1 className="truncate text-xl font-semibold tracking-tight text-gray-900">{list?.clientName ?? "Estudio de ahorro"}</h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <StudySteps active={studyStep({ picking: showPicker, proposals: study?.proposals.length ?? 0, closed: study?.status === "closed" })} />
          )}
          {study && !showPicker && study.status !== "closed" && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPicking(true)}>
              <RotateCcw className="size-3.5" />
              Otra factura
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger ring-1 ring-danger-200">
          {error}
        </p>
      )}

      {loading ? (
        <ResultSkeleton />
      ) : showPicker ? (
        list && (
          <InvoicePicker
            invoices={list.invoices}
            busy={busy}
            cupsPrompt={cupsPrompt}
            onAnalyze={analyze}
            onCancel={study ? () => setPicking(false) : undefined}
            gas={isGas}
          />
        )
      ) : (
        <StudyResult
          key={study.id}
          study={study}
          invoices={list?.invoices ?? []}
          busy={busy}
          proposing={proposing}
          clientName={list?.clientName ?? null}
          onOptions={changeOptions}
          onPropose={propose}
          onComplete={complete}
          onReviewInvoice={reviewInvoice}
        />
      )}
    </div>
  );
}
