"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Mail } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";
import type { getRatesOverview } from "@/comparador/rates/views";
import { IngestReviewSheet } from "./IngestReviewSheet";

type Overview = Awaited<ReturnType<typeof getRatesOverview>>;

/**
 * Aviso de tarifas del comparador propio en la lista de comercializadoras:
 * las que llevan más de un mes sin precios nuevos, los anexos pendientes, los
 * correos que no dicen de qué comercializadora son y el tiempo hasta aprobar.
 */
export function RatesOverviewCard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v2/comparador/rates/overview", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.success && setOverview(body.data))
      .catch(() => undefined);
    return () => controller.abort();
  }, [reloadKey]);

  if (!overview) return null;
  const stale = overview.suppliers.filter(({ status }) => status === "stale");
  const pending = overview.suppliers.reduce((sum, { pendingIngests }) => sum + pendingIngests, 0);
  if (stale.length === 0 && pending === 0 && overview.unassigned.length === 0) return null;

  return (
    <Card>
      <CardContent className="py-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1 font-medium">
            <AlertTriangle className="h-4 w-4 text-warning-600" /> Tarifas del comparador
          </span>
          {pending > 0 && <span>{pending} anexos por revisar en sus fichas</span>}
          {overview.medianDecisionHours !== null && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" /> {overview.medianDecisionHours} h hasta aprobar (mediana)
            </span>
          )}
        </div>

        {overview.unassigned.length > 0 && (
          <div className="space-y-1">
            <p className="text-muted-foreground">Recibidos sin comercializadora:</p>
            <ul>
              {overview.unassigned.map((ingest) => (
                <li key={ingest.id}>
                  <button
                    type="button"
                    className="flex items-center gap-2 underline"
                    onClick={() => setReviewing(ingest.id)}
                  >
                    <Mail className="h-4 w-4" />
                    {ingest.fileName ?? ingest.emailSubject ?? "Correo"}
                    {ingest.emailFrom && <span className="text-muted-foreground">· {ingest.emailFrom}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stale.length > 0 && (
          <p className="text-muted-foreground">
            Sin actualizar desde hace más de un mes:{" "}
            {stale.map((supplier, index) => (
              <span key={supplier.comercializadoraId}>
                {index > 0 && ", "}
                <Link className="underline" href={`/comercializadoras/${supplier.name}`}>
                  {supplier.name}
                </Link>{" "}
                ({supplier.days} días)
              </span>
            ))}
          </p>
        )}
      </CardContent>
      <IngestReviewSheet
        ingestId={reviewing}
        onClose={() => setReviewing(null)}
        onChanged={() => setReloadKey((key) => key + 1)}
      />
    </Card>
  );
}
