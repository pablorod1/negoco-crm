"use client";

import { Link } from "next-view-transitions";
import { ArrowRight, ExternalLink, FileCheck2 } from "lucide-react";
import type { NegocoStudyForTramite } from "@/comparador/study/tramite";
import { Button } from "@/core/components/ui/button";
import { euros, percentOf } from "./study/api";

/**
 * Lo que se le ha ofrecido al cliente con el comparador propio: la propuesta
 * elegida al completar el estudio, con su PDF.
 */
export function ChosenProposalCard({
  comparativaId,
  chosen,
}: {
  comparativaId: string;
  chosen: NonNullable<NegocoStudyForTramite["chosen"]>;
}) {
  const today = chosen.currentTotal;
  const saves = chosen.savings !== null && chosen.savings > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Propuesta al cliente</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/comparativas/${comparativaId}/estudio`}>
              Ver estudio
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={chosen.pdfUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Ver PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-900">{chosen.comercializadoraName}</p>
          <p className="truncate text-sm text-gray-600" title={chosen.productName}>
            {chosen.productName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Propuesta {chosen.number} · luz 2.0TD</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pagaría</p>
          <p className="text-base font-semibold tabular-nums text-gray-900">
            {chosen.annualTotal === null ? "—" : `${euros(chosen.annualTotal)}/año`}
          </p>
          {today !== null && <p className="text-xs tabular-nums text-muted-foreground">Hoy {euros(today)}/año</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ahorro</p>
          {chosen.savings === null ? (
            <p className="text-base font-semibold text-gray-400">—</p>
          ) : (
            <>
              <p className={`text-base font-semibold tabular-nums ${saves ? "text-success-700" : "text-danger"}`}>
                {saves ? euros(chosen.savings) : `${euros(-chosen.savings)} más`}
                <span className="text-xs font-normal">/año</span>
              </p>
              {saves && today !== null && (
                <p className="text-xs text-muted-foreground">{percentOf(chosen.savings, today)} % menos que hoy</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
