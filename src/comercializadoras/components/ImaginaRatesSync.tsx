"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ImaginaRate } from "@/comercializadoras/types";
import { Button } from "@/core/components/ui/button";

export default function ImaginaRatesSync({ rates }: { rates: ImaginaRate[] }) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef(false);
  const dates = rates
    .map((rate) => Date.parse(rate.synced_at || ""))
    .filter(Number.isFinite);
  const lastSync = dates.length ? new Date(Math.max(...dates)) : null;

  const synchronize = async () => {
    if (pending.current) return;
    pending.current = true;
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/v2/integrations/imagina-energia/tarifas",
        { method: "POST" },
      );
      if (!response.ok)
        throw new Error(
          "No se pudieron sincronizar las tarifas. Inténtalo de nuevo.",
        );
      const result = await response.json();
      if (result.success !== true)
        throw new Error("Imagina no pudo completar la sincronización.");
      const data = result.data;
      if (!data || typeof data.count !== "number")
        throw new Error("Respuesta de sincronización no válida.");
      const changes = [data.added, data.updated, data.deactivated].every(
        (value) => typeof value === "number",
      )
        ? ` ${data.added} nuevas, ${data.updated} actualizadas y ${data.deactivated} retiradas.`
        : "";
      setMessage(
        data.count === 0
          ? "Sincronización completada. Imagina no devuelve tarifas disponibles para este canal."
          : `Sincronización completada: ${data.count} tarifas disponibles.${changes}`,
      );
      window.dispatchEvent(new Event("imagina-rates-synced"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Error al sincronizar tarifas",
      );
    } finally {
      pending.current = false;
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-2">
      {rates.length === 0 && (
        <p role="alert" className="text-sm text-amber-700">
          No hay tarifas disponibles. Sincroniza el catálogo de Imagina sin
          salir de esta pantalla.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={synchronize}
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Sincronizando…" : "Sincronizar tarifas"}
        </Button>
        {lastSync && (
          <p className="text-xs text-muted-foreground">
            Última sincronización:{" "}
            <time dateTime={lastSync.toISOString()}>
              {lastSync.toLocaleString("es-ES")}
            </time>
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Sincroniza para comprobar los últimos cambios de Imagina.
      </p>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
