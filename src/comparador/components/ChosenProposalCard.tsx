"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileCheck2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { euros, percentOf, studyApi, type StudyView } from "./study/api";
import { NegocoStudyPanel } from "./NegocoStudyPanel";

type ChosenProposal = StudyView["proposals"][number];

/**
 * Lo que se le ha ofrecido al cliente con el comparador propio: la propuesta
 * elegida al completar el estudio, con su PDF. Sin estudio completado no se
 * enseña nada.
 */
export function ChosenProposalCard({ comparativaId }: { comparativaId: string }) {
  const [proposal, setProposal] = useState<ChosenProposal | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await studyApi.list(comparativaId);
      const closed = list.studies.find(({ status }) => status === "closed");
      if (!closed) return;
      const study = await studyApi.view(closed.id);
      const chosen = study.proposals.find((item) => item.chosen);
      if (!cancelled && chosen) setProposal(chosen);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [comparativaId]);

  if (!proposal) return null;
  // Lo que pagaba según la propia propuesta: los precios de hoy pueden haber cambiado desde entonces.
  const today = proposal.savings === null ? null : proposal.annualTotal + proposal.savings;
  const saves = proposal.savings !== null && proposal.savings > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Propuesta al cliente</p>
        </div>
        <div className="flex gap-2">
          <NegocoStudyPanel comparativaId={comparativaId} triggerLabel="Ver estudio" triggerVariant="ghost" />
          <Button asChild size="sm" variant="outline">
            <a href={proposal.pdfUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Ver PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-900">{proposal.comercializadoraName}</p>
          <p className="truncate text-sm text-gray-600" title={proposal.productName}>
            {proposal.productName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Propuesta {proposal.number} · luz 2.0TD</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pagaría</p>
          <p className="text-base font-semibold tabular-nums text-gray-900">{euros(proposal.annualTotal)}/año</p>
          {today !== null && <p className="text-xs tabular-nums text-muted-foreground">Hoy {euros(today)}/año</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ahorro</p>
          {proposal.savings === null ? (
            <p className="text-base font-semibold text-gray-400">—</p>
          ) : (
            <>
              <p className={`text-base font-semibold tabular-nums ${saves ? "text-success-700" : "text-danger"}`}>
                {saves ? euros(proposal.savings) : `${euros(-proposal.savings)} más`}
                <span className="text-xs font-normal">/año</span>
              </p>
              {saves && today !== null && (
                <p className="text-xs text-muted-foreground">{percentOf(proposal.savings, today)} % menos que hoy</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
