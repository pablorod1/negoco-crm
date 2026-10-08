"use client";

import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";
import type { StudyMonthMetrics } from "@/comparador/study/metrics";

const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

const percent = (part: number, whole: number) => (whole > 0 ? ` (${Math.round((part / whole) * 100)} %)` : "");

function line(metrics: StudyMonthMetrics) {
  return [
    `${metrics.analyses} ${metrics.analyses === 1 ? "factura analizada" : "facturas analizadas"}`,
    `${metrics.completed} ${metrics.completed === 1 ? "estudio completado" : "estudios completados"}`,
    `${metrics.inTramite} en trámite${percent(metrics.inTramite, metrics.completed)}`,
    metrics.averageSavings !== null
      ? `ahorro medio ${metrics.averageSavings.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}/año`
      : null,
    `IA ${metrics.aiCostUsd.toLocaleString("es-ES", { maximumFractionDigits: 3 })} $`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Uso del comparador propio en la lista de comparativas (admin y backoffice):
 * cuántas facturas se analizan, cuántos estudios se completan y cuántos acaban
 * en trámite. Es la base del cupo del plan.
 */
export function StudyMetricsCard() {
  const [months, setMonths] = useState<StudyMonthMetrics[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v2/comparador/metrics", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.success && setMonths(body.data.months))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!months || months.length === 0) return null;
  const [latest, ...previous] = months;

  return (
    <Card className="mb-4">
      <CardContent className="py-3 space-y-1 text-sm">
        <p className="flex flex-wrap items-center gap-x-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="font-medium">Estudio Negoco Cloud, {monthName(latest.month)}:</span>
          <span>{line(latest)}</span>
        </p>
        {previous.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {previous.map((metrics) => `${monthName(metrics.month)}: ${metrics.analyses} analizadas, ${metrics.completed} completados, ${metrics.inTramite} en trámite`).join(" · ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
