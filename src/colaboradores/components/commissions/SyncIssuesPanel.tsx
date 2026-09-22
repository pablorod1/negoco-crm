"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import { cn } from "@/core/utils";
import {
  STATUS_META,
  parseWarnings,
} from "./sync-issues-utils";
import type { AbarcaUserSyncStatus } from "@/core/hooks/use-abarca-sync-statuses";

interface Props {
  statuses: AbarcaUserSyncStatus[];
  onChanged: () => Promise<void> | void;
  onCheck: () => Promise<void> | void;
}

/**
 * Lista las discrepancias entre el CRM y el Comparador por colaborador.
 * Solo aparece cuando hay algo que corregir: usuarios pendientes de envío o
 * cuyo envío falló (`attention`). Cada aviso se puede reintentar individual o
 * en bloque con el botón superior.
 */
export default function SyncIssuesPanel({ statuses, onChanged, onCheck }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);

  const issues = statuses.filter(
    (status) => status.status === "attention" || status.status === "pending",
  );

  if (issues.length === 0) {
    return null;
  }

  const retry = async (userId: string) => {
    setRetrying((current) => new Set(current).add(userId));
    try {
      const res = await fetch("/api/v2/commissions/abarca/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo sincronizar");
      }
      await onChanged();
    } catch (error) {
      showCustomToast({
        title: "Error al sincronizar",
        message:
          error instanceof Error ? error.message : "Error desconocido",
        icon: TriangleAlert,
        iconSize: 24,
        iconColor: "red",
      });
    } finally {
      setRetrying((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  };

  const retryAll = async () => {
    for (const issue of issues) {
      if (issue.abarca_user_id) await retry(issue.user_id);
    }
  };

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <AlertTriangle size={20} className="text-amber-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">
            {issues.length === 1
              ? "1 colaborador tiene discrepancias con el Comparador"
              : `${issues.length} colaboradores tienen discrepancias con el Comparador`}
          </p>
          <p className="text-xs text-amber-800">
            Lo configurado en el CRM no coincide con el Comparador. Revisa el
            detalle y reintenta la sincronización.
          </p>
        </div>
        <Button
          size="sm" variant="outline" disabled={checking}
          onClick={async () => {
            setChecking(true);
            try { await onCheck(); } finally { setChecking(false); }
          }}
        >
          {checking ? "Comprobando..." : "Comprobar ahora"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
          onClick={retryAll}
          disabled={retrying.size > 0}
        >
          <RefreshCw
            size={14}
            className={cn("mr-2", retrying.size > 0 && "animate-spin")}
          />
          Reintentar todos
        </Button>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors"
          aria-label={collapsed ? "Mostrar detalle" : "Ocultar detalle"}
          aria-expanded={!collapsed}
        >
          <ChevronDown
            size={16}
            className={cn("transition-transform", collapsed && "-rotate-90")}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="border-t border-amber-200 divide-y divide-amber-100 bg-white">
          {issues.map((issue) => {
            const warnings = parseWarnings(issue.last_warnings);
            const meta = STATUS_META[issue.status];
            const isRetrying = retrying.has(issue.user_id);
            return (
              <div
                key={issue.user_id}
                className="flex items-start justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">
                      {issue.name}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {issue.status === "pending" && (
                    <p className="text-xs text-gray-500">
                      Cambios aún no enviados al Comparador.
                    </p>
                  )}
                  {issue.last_error && (
                    <p className="text-xs text-red-600">{issue.last_error}</p>
                  )}
                  {warnings.length > 0 && (
                    <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
                      {warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  {!issue.abarca_user_id && (
                    <p className="text-xs text-gray-400">
                      Sin identidad del Comparador: primero hay que vincular su
                      usuario del Comparador.
                    </p>
                  )}
                </div>
                {issue.abarca_user_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-200 shrink-0"
                    onClick={() => retry(issue.user_id)}
                    disabled={isRetrying}
                  >
                    <RefreshCw
                      size={14}
                      className={cn("mr-2", isRetrying && "animate-spin")}
                    />
                    {isRetrying ? "Sincronizando..." : "Sincronizar"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
