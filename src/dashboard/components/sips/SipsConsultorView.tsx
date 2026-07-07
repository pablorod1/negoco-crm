"use client";

import React from "react";
import { Activity, AlertCircle, Search, Zap } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Skeleton } from "@/core/components/ui/skeleton";
import {
  isValidApoloSipsCups,
  sanitizeCups,
  summarizeElectricityConsumption,
  useApoloSips,
} from "@/integrations/apolo-sips";
import type {
  ApoloSipsPeriod,
  ApoloSipsPeriodValues,
} from "@/integrations/apolo-sips";

type SipsMessage = {
  type: "warning" | "success";
  text: string;
};

const PERIODS: ApoloSipsPeriod[] = ["P1", "P2", "P3", "P4", "P5", "P6"];

const NUMBER_FORMAT = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

export function SipsConsultorView() {
  const [cups, setCups] = React.useState("");
  const [lastConsultedCups, setLastConsultedCups] = React.useState("");
  const [summary, setSummary] = React.useState<ReturnType<
    typeof summarizeElectricityConsumption
  > | null>(null);
  const [message, setMessage] = React.useState<SipsMessage | null>(null);
  const { fetchConsumptions, loading } = useApoloSips();

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const sanitizedCups = sanitizeCups(cups);
      if (!isValidApoloSipsCups(sanitizedCups)) {
        setSummary(null);
        setLastConsultedCups("");
        setMessage({
          type: "warning",
          text: "El CUPS no tiene un formato valido para Apolo SIPS.",
        });
        return;
      }

      setMessage(null);
      setSummary(null);
      setLastConsultedCups(sanitizedCups);
      setCups(sanitizedCups);

      const data = await fetchConsumptions({
        cups: sanitizedCups,
        tipoSuministro: "ELECTRICIDAD",
      });

      if (!data || data.tipoSuministro !== "ELECTRICIDAD" || !data.consumos) {
        setMessage({
          type: "warning",
          text: "No se pudo obtener consumo de Apolo SIPS.",
        });
        return;
      }

      const nextSummary = summarizeElectricityConsumption(data.consumos.rows);
      if (nextSummary.rows.length === 0) {
        setMessage({
          type: "warning",
          text: "Apolo SIPS no devolvio consumos para este CUPS.",
        });
        return;
      }

      setSummary(nextSummary);
      setMessage({
        type: "success",
        text: `Consulta completada con ${nextSummary.rows.length} meses.`,
      });
    },
    [cups, fetchConsumptions],
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-xl text-gray-900">
                Consultor SIPS
              </CardTitle>
              <CardDescription>Apolo SIPS</CardDescription>
            </div>
            {lastConsultedCups ? (
              <Badge variant="secondary" className="w-fit font-mono">
                {lastConsultedCups}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="space-y-2">
              <Label htmlFor="sips-cups">CUPS</Label>
              <Input
                id="sips-cups"
                name="cups"
                value={cups}
                onChange={(event) => setCups(event.target.value)}
                placeholder="ES0000000000000000AA"
                className="font-mono uppercase"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="self-end"
              disabled={loading || !cups.trim()}
            >
              {loading ? (
                <>
                  <Activity className="h-4 w-4 animate-pulse" />
                  Consultando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Consultar
                </>
              )}
            </Button>
          </form>

          {message ? (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              <span>{message.text}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {loading ? (
        <SipsLoadingState />
      ) : summary ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">
                Consumo total
              </CardTitle>
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary-600" />
                <p className="text-3xl font-bold text-gray-950">
                  {formatValue(summary.totalActiveEnergyKwh)} kWh
                </p>
              </div>
              <CardDescription>
                Ultimos {summary.rows.length} meses
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PeriodValuesCard
              title="Energia activa"
              description="Consumo por periodo"
              values={summary.activeEnergyKwhByPeriod}
              unit="kWh"
            />
            <PeriodValuesCard
              title="Potencia demandada"
              description="Maximo por periodo"
              values={summary.maxDemandPowerKwByPeriod}
              unit="kW"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PeriodValuesCard({
  title,
  description,
  values,
  unit,
}: {
  title: string;
  description: string;
  values: ApoloSipsPeriodValues;
  unit: "kWh" | "kW";
}) {
  const maxValue = Math.max(...PERIODS.map((period) => values[period]), 0);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-gray-900">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PERIODS.map((period) => (
            <div
              key={period}
              className="rounded-lg border border-gray-100 bg-gray-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-700">
                  {period}
                </span>
                <span className="text-sm font-bold text-gray-950">
                  {formatValue(values[period])} {unit}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-primary-600"
                  style={{
                    width:
                      maxValue > 0
                        ? `${Math.max((values[period] / maxValue) * 100, 4)}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SipsLoadingState() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

function formatValue(value: number): string {
  return NUMBER_FORMAT.format(value);
}
