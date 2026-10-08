"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ExternalLink, FileText, Loader2, RotateCcw } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { Button } from "@/core/components/ui/button";
import type { StudyClientDataInput } from "@/comparador/study/client-data";
import {
  euros,
  studyApi,
  type ComparativaStudies,
  type StudyOfferView,
  type StudyOptionsInput,
  type StudyView,
} from "./api";
import { CompleteDialog, initialClient } from "./CompleteDialog";
import { InvoicePicker } from "./InvoicePicker";
import { OfferList } from "./OfferList";
import { StudyFilters, parseFee } from "./StudyFilters";
import { StudyOverview } from "./StudyOverview";
import { StudySteps, studyStep } from "./StudySteps";

/** La oferta que más ahorra; sin lo que paga hoy, la más barata. */
function bestOffer(study: StudyView): StudyOfferView | null {
  if (study.offers.length === 0) return null;
  if (!study.current) return study.offers.reduce((best, offer) => (offer.cost.total < best.cost.total ? offer : best));
  return study.offers.reduce((best, offer) => ((offer.savings ?? -Infinity) > (best.savings ?? -Infinity) ? offer : best));
}

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/**
 * Las propuestas creadas, siempre a la vista al pie del panel, con el paso
 * siguiente: completar el estudio. Sin propuestas no se enseña.
 */
function ProposalTray({ study, onComplete }: { study: StudyView; onComplete: () => void }) {
  const closed = study.status === "closed";
  const chosen = study.proposals.find(({ chosen }) => chosen);

  if (closed) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-success-200 bg-success-50 p-3 text-sm">
        <CheckCircle2 className="size-5 shrink-0 text-success-600" />
        <p className="min-w-0 flex-1 text-gray-800">
          <span className="font-medium">Estudio completado</span>
          {chosen ? (
            <>
              {" "}
              con {chosen.comercializadoraName} · {chosen.productName}
              {chosen.savings !== null && chosen.savings > 0 ? `, ahorra ${euros(chosen.savings)} al año` : ""}. El PDF
              está en los documentos de la comparativa.
            </>
          ) : (
            "."
          )}
        </p>
        {chosen && (
          <Button asChild size="sm" variant="outline">
            <a href={chosen.pdfUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Ver propuesta
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">
          {study.proposals.length} {study.proposals.length === 1 ? "propuesta" : "propuestas"}
        </span>
        {study.proposals.map((proposal) => (
          <a
            key={proposal.id}
            href={proposal.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-56 items-center gap-1.5 rounded-full border bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:border-gray-300 hover:bg-white"
            title={`${proposal.comercializadoraName} · ${proposal.productName}`}
          >
            <span className="font-medium">{proposal.number}</span>
            <span className="truncate">{proposal.comercializadoraName}</span>
            {proposal.savings !== null && proposal.savings > 0 && (
              <span className="text-success-700">ahorra {euros(proposal.savings)}</span>
            )}
            <ExternalLink className="size-3 shrink-0 text-gray-400" />
          </a>
        ))}
      </div>
      <Button onClick={onComplete}>
        Completar estudio
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

/** Resultado del estudio: la decisión arriba, las ofertas después y las propuestas al pie. */
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
  const [completing, setCompleting] = useState(false);
  const closed = study.status === "closed";
  const best = bestOffer(study);
  const period = study.invoice?.billingPeriod;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <FileText className="size-4 shrink-0" />
          <span className="truncate">
            {study.invoiceFileName}
            {period?.from && period.to ? ` · del ${shortDate(period.from)} al ${shortDate(period.to)}` : ""}
          </span>
        </p>
        {!closed && (
          <Button variant="ghost" size="sm" onClick={onRestart}>
            <RotateCcw className="size-3.5" />
            Analizar otra factura
          </Button>
        )}
      </div>

      <StudyOverview study={study} best={best} />

      {!closed && (
        <div className="rounded-2xl border bg-white p-4">
          <StudyFilters
            study={study}
            busy={busy}
            feeText={feeText}
            onFeeText={setFeeText}
            onOptions={onOptions}
          />
        </div>
      )}

      {!closed && study.proposals.length === 0 && study.offers.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <FileText className="mt-0.5 size-4 shrink-0" />
          <span>
            Pulsa <span className="font-medium text-gray-700">Crear propuesta</span> en la tarifa que quieras
            presentar: se abre el PDF que recibirá el cliente. Puedes crear varias y elegir una al completar.
          </span>
        </p>
      )}

      <OfferList
        study={study}
        bestKey={best && (!study.current || (best.savings ?? 0) > 0) ? best.key : null}
        proposing={proposing}
        onPropose={(offer) => onPropose(offer, { feeEnergyPerMwh: parseFee(feeText) })}
      />

      {(closed || study.proposals.length > 0) && (
        <div className="sticky bottom-0 -mx-6 -mb-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent px-6 pb-6 pt-4">
          <ProposalTray study={study} onComplete={() => setCompleting(true)} />
        </div>
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
      else setError("El navegador ha bloqueado la pestaña nueva: abre el PDF desde las propuestas, al pie.");
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

  const showPicker = picking || !study;

  return (
    <div className="space-y-5">
      {list && list.service === "Luz" && (
        <StudySteps
          active={studyStep({
            picking: showPicker,
            proposals: study?.proposals.length ?? 0,
            closed: study?.status === "closed",
          })}
        />
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {list && list.service !== "Luz" ? (
        <p className="text-sm">El comparador propio compara luz 2.0TD; esta comparativa es de gas.</p>
      ) : showPicker ? (
        list && (
          <InvoicePicker
            pdfs={list.pdfs}
            busy={busy}
            onAnalyze={analyze}
            onCancel={study ? () => setPicking(false) : undefined}
          />
        )
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
