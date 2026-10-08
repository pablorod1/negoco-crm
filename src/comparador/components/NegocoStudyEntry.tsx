"use client";

import { useEffect, useState } from "react";
import { Link } from "next-view-transitions";
import { ArrowRight, Calculator, Loader2 } from "lucide-react";
import { cn } from "@/core/utils";
import { studyApi } from "./study/api";

type EntryState =
  | { kind: "loading" }
  | { kind: "new" }
  | { kind: "open"; proposals: number }
  | { kind: "closed" };

/**
 * Entrada al comparador propio desde la ficha: empieza el estudio o lo
 * continúa donde se dejó, en su vista completa.
 */
export function NegocoStudyEntry({ comparativaId }: { comparativaId: string }) {
  const [state, setState] = useState<EntryState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await studyApi.list(comparativaId);
      const latest = list.studies.find(({ status }) => status !== "failed");
      if (cancelled) return;
      if (!latest) return setState({ kind: "new" });
      if (latest.status === "closed") return setState({ kind: "closed" });
      const view = await studyApi.view(latest.id);
      if (!cancelled) setState({ kind: "open", proposals: view.proposals.length });
    })().catch(() => !cancelled && setState({ kind: "new" }));
    return () => {
      cancelled = true;
    };
  }, [comparativaId]);

  const copy =
    state.kind === "open"
      ? {
          title: "Continuar estudio",
          detail:
            state.proposals > 0
              ? `Factura analizada · ${state.proposals} ${state.proposals === 1 ? "propuesta creada" : "propuestas creadas"}`
              : "Factura analizada · elige la oferta",
        }
      : state.kind === "closed"
        ? { title: "Ver estudio", detail: "Estudio completado" }
        : { title: "Estudio Negoco Cloud", detail: "Analiza la factura y compara las tarifas" };

  return (
    <Link
      href={`/comparativas/${comparativaId}/estudio`}
      aria-disabled={state.kind === "loading"}
      className={cn(
        "group flex items-center gap-3 rounded-xl p-3 ring-1 transition-all",
        state.kind === "open"
          ? "bg-primary-600 text-white ring-primary-600 hover:bg-primary-700"
          : "bg-white text-gray-900 ring-gray-200 hover:ring-gray-300 hover:shadow-sm",
        state.kind === "loading" && "pointer-events-none opacity-70",
      )}
    >
      <span className={cn("rounded-lg p-2", state.kind === "open" ? "bg-white/15" : "bg-primary-50 text-primary-600")}>
        {state.kind === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{state.kind === "loading" ? "Estudio Negoco Cloud" : copy.title}</span>
        <span className={cn("block truncate text-xs", state.kind === "open" ? "text-white/80" : "text-gray-500")}>
          {state.kind === "loading" ? "Comprobando el estudio…" : copy.detail}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
