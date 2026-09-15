"use client";

import React from "react";
import { Activity, AlertCircle, Flame, Search, Zap } from "lucide-react";
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
import { Progress } from "@/core/components/ui/progress";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/core/components/ui/toggle-group";
import {
  getApoloSipsBaseCups,
  isValidApoloSipsCups,
  sanitizeCups,
  summarizeElectricityConsumption,
  summarizeGasConsumption,
  useApoloSips,
} from "@/integrations/apolo-sips";
import type {
  ApoloSipsElectricityConsumptionRow,
  ApoloSipsElectricityConsumptionSummary,
  ApoloSipsGasConsumptionRow,
  ApoloSipsGasConsumptionSummary,
  ApoloSipsGasPeriod,
  ApoloSipsPeriod,
  ApoloSipsResponseData,
  ApoloSipsSupplyType,
} from "@/integrations/apolo-sips";

type SipsMessage = {
  type: "warning" | "success";
  text: string;
};

type SipsSupplyMode = ApoloSipsSupplyType | "AUTO";

type SipsProgress = {
  percent: number;
  task: string;
  detail: string;
};

type SipsSummary =
  | {
    supplyType: "ELECTRICIDAD";
    consumptionSummary: ApoloSipsElectricityConsumptionSummary;
  }
  | {
    supplyType: "GAS";
    consumptionSummary: ApoloSipsGasConsumptionSummary;
  };

const PERIODS: ApoloSipsPeriod[] = ["P1", "P2", "P3", "P4", "P5", "P6"];
const GAS_PERIODS: ApoloSipsGasPeriod[] = ["P1", "P2"];

const NUMBER_FORMAT = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

const TARIFF_TYPE_BY_ATR_CODE: Record<string, string> = {
  "018": "2.0TD",
  "019": "3.0TD",
  "020": "6.1TD",
};

const SUPPLY_MODE_OPTIONS: {
  value: SipsSupplyMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
    { value: "AUTO", label: "Auto", icon: Search },
    { value: "ELECTRICIDAD", label: "Luz", icon: Zap },
    { value: "GAS", label: "Gas", icon: Flame },
  ];

export function SipsConsultorView() {
  const [cups, setCups] = React.useState("");
  const [supplyMode, setSupplyMode] = React.useState<SipsSupplyMode>("AUTO");
  const [lastConsultedCups, setLastConsultedCups] = React.useState("");
  const [result, setResult] = React.useState<SipsSummary | null>(null);
  const [message, setMessage] = React.useState<SipsMessage | null>(null);
  const [progress, setProgress] = React.useState<SipsProgress | null>(null);
  const { fetchConsumptions, loading } = useApoloSips();
  const isConsulting = loading || progress !== null;

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setProgress({
        percent: 10,
        task: "Validando CUPS",
        detail: "Normalizando codigo de suministro",
      });

      const sanitizedCups = sanitizeCups(cups);
      if (!isValidApoloSipsCups(sanitizedCups)) {
        setResult(null);
        setLastConsultedCups("");
        setProgress(null);
        setMessage({
          type: "warning",
          text: "El CUPS no tiene un formato valido para SIPS.",
        });
        return;
      }

      const apoloSipsCups = getApoloSipsBaseCups(sanitizedCups);
      const supplyTypes = getSupplyTypesForMode(supplyMode);

      setMessage(null);
      setResult(null);
      setLastConsultedCups(apoloSipsCups);
      setCups(apoloSipsCups);

      try {
        const lookupSupplyType = async (
          supplyType: ApoloSipsSupplyType,
          index: number,
        ) => {
          setProgress(getCheckingProgress(supplyType, index));
          const data = await fetchConsumptions({
            cups: apoloSipsCups,
            tipoSuministro: supplyType,
          });

          setProgress(getCalculationProgress(supplyType));
          return summarizeSipsResponse(data, supplyType);
        };

        let nextResult = await lookupSupplyType(supplyTypes[0], 0);
        if (!nextResult && supplyTypes[1]) {
          nextResult = await lookupSupplyType(supplyTypes[1], 1);
        }

        if (!nextResult) {
          setMessage({
            type: "warning",
            text: getEmptyConsumptionMessage(supplyMode),
          });
          return;
        }

        setProgress({
          percent: 100,
          task: "Calculando consumo anual",
          detail: "Consumo anual calculado",
        });
        setResult(nextResult);
        setMessage({
          type: "success",
          text: `Consulta ${getSupplyTypeLabel(
            nextResult.supplyType,
          ).toLowerCase()} completada con ${nextResult.consumptionSummary.rows.length
            } meses.`,
        });
      } finally {
        setProgress(null);
      }
    },
    [cups, fetchConsumptions, supplyMode],
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
            </div>
            {lastConsultedCups ? (
              <Badge variant="secondary" className="w-fit font-mono">
                {lastConsultedCups}
              </Badge>
            ) : null}
            <div className="space-y-2">
              <ToggleGroup
                id="sips-supply-mode"
                type="single"
                value={supplyMode}
                onValueChange={(value) => {
                  if (value) setSupplyMode(value as SipsSupplyMode);
                }}
                variant="outline"
                className="grid h-7 grid-cols-3 overflow-hidden border rounded-full p-0"
                disabled={isConsulting}
              >
                {SUPPLY_MODE_OPTIONS.map((option) => {
                  const Icon = option.icon;

                  return (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      aria-label={option.label}
                      className="h-7 min-w-16 gap-1.5 border-0 text-xs font-medium data-[state=on]:bg-primary-600 data-[state=on]:text-white"
                    >
                      <Icon className="size-3.5!" />
                      <span>{option.label}</span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]"
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
                disabled={isConsulting}
              />
            </div>

            <Button
              type="submit"
              className="self-end"
              disabled={isConsulting || !cups.trim()}
            >
              {isConsulting ? (
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
              className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${message.type === "success"
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

      {isConsulting ? (
        <SipsLoadingState progress={progress} />
      ) : result?.supplyType === "ELECTRICIDAD" ? (
        <ElectricitySummaryView summary={result.consumptionSummary} />
      ) : result?.supplyType === "GAS" ? (
        <GasSummaryView summary={result.consumptionSummary} />
      ) : null}
    </div>
  );
}

function ElectricitySummaryView({
  summary,
}: {
  summary: ApoloSipsElectricityConsumptionSummary;
}) {
  const tariffType = getElectricityTariffType(summary.rows);

  return (
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
          <CardDescription>Ultimos {summary.rows.length} meses</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-500">Tipo de tarifa</p>
            <p className="mt-1 text-xl font-bold text-gray-950">
              {tariffType || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PeriodValuesCard
          title="Energia activa"
          description="Consumo por periodo"
          periods={PERIODS}
          values={summary.activeEnergyKwhByPeriod}
          unit="kWh"
        />
        <PeriodValuesCard
          title="Potencia demandada"
          description="Maximo por periodo"
          periods={PERIODS}
          values={summary.maxDemandPowerKwByPeriod}
          unit="kW"
        />
      </div>
    </div>
  );
}

function GasSummaryView({
  summary,
}: {
  summary: ApoloSipsGasConsumptionSummary;
}) {
  const tariffType = getGasTariffType(summary.rows);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500">
            Consumo total
          </CardTitle>
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-primary-600" />
            <p className="text-3xl font-bold text-gray-950">
              {formatValue(summary.totalConsumptionKwh)} kWh
            </p>
          </div>
          <CardDescription>Ultimos {summary.rows.length} meses</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-500">
              Tarifa de peaje
            </p>
            <p className="mt-1 text-xl font-bold text-gray-950">
              {tariffType || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PeriodValuesCard
          title="Consumo gas"
          description="Consumo por periodo"
          periods={GAS_PERIODS}
          values={summary.consumptionKwhByPeriod}
          unit="kWh"
        />
        <GasFlowCard summary={summary} />
      </div>
    </div>
  );
}

function GasFlowCard({
  summary,
}: {
  summary: ApoloSipsGasConsumptionSummary;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-gray-900">
          Caudal diario
        </CardTitle>
        <CardDescription>Valores en kWh/dia</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <GasFlowMetric
            label="Medio"
            value={summary.averageDailyFlowKwhPerDay}
          />
          <GasFlowMetric label="Minimo" value={summary.minDailyFlowKwhPerDay} />
          <GasFlowMetric label="Maximo" value={summary.maxDailyFlowKwhPerDay} />
        </div>
      </CardContent>
    </Card>
  );
}

function GasFlowMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-950">
        {formatValue(value)} kWh/dia
      </p>
    </div>
  );
}

function PeriodValuesCard<TPeriod extends string>({
  title,
  description,
  periods,
  values,
  unit,
}: {
  title: string;
  description: string;
  periods: readonly TPeriod[];
  values: Record<TPeriod, number>;
  unit: "kWh" | "kW";
}) {
  const maxValue = Math.max(...periods.map((period) => values[period]), 0);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-gray-900">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {periods.map((period) => (
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

function SipsLoadingState({ progress }: { progress: SipsProgress | null }) {
  const currentProgress = progress ?? {
    percent: 5,
    task: "Preparando consulta",
    detail: "Inicializando APOLO SIPS",
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-500">
              {currentProgress.task}
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-950">
              {currentProgress.detail}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit text-sm font-semibold">
            {currentProgress.percent}%
          </Badge>
        </div>
        <Progress
          value={currentProgress.percent}
          className="mt-5 h-2 bg-gray-100"
          indicatorClassName="bg-primary-600"
        />
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-500 sm:grid-cols-3">
          <LoadingStep
            label="Validando CUPS"
            active={currentProgress.percent >= 10}
          />
          <LoadingStep
            label="Comprobando LUZ/GAS"
            active={currentProgress.percent >= 35}
          />
          <LoadingStep
            label="Calculando consumo anual"
            active={currentProgress.percent >= 80}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingStep({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${active
        ? "border-primary-200 bg-primary-50 text-primary-700"
        : "border-gray-100 bg-gray-50 text-gray-400"
        }`}
    >
      {label}
    </div>
  );
}

function getSupplyTypesForMode(mode: SipsSupplyMode): ApoloSipsSupplyType[] {
  if (mode === "AUTO") {
    return ["ELECTRICIDAD", "GAS"];
  }

  return [mode];
}

function getCheckingProgress(
  supplyType: ApoloSipsSupplyType,
  index: number,
): SipsProgress {
  if (supplyType === "ELECTRICIDAD") {
    return {
      percent: 35,
      task: "Comprobando LUZ/GAS",
      detail: "Consultando primero electricidad",
    };
  }

  return {
    percent: index > 0 ? 65 : 35,
    task: "Comprobando LUZ/GAS",
    detail: index > 0 ? "Sin datos de luz, consultando gas" : "Consultando gas",
  };
}

function getCalculationProgress(supplyType: ApoloSipsSupplyType): SipsProgress {
  return {
    percent: 85,
    task: "Calculando consumo anual",
    detail:
      supplyType === "ELECTRICIDAD"
        ? "Analizando consumos de luz"
        : "Analizando consumos de gas",
  };
}

function summarizeSipsResponse(
  data: ApoloSipsResponseData | null,
  expectedSupplyType: ApoloSipsSupplyType,
): SipsSummary | null {
  if (expectedSupplyType === "ELECTRICIDAD") {
    if (!data || data.tipoSuministro !== "ELECTRICIDAD" || !data.consumos) {
      return null;
    }

    const consumptionSummary = summarizeElectricityConsumption(
      data.consumos.rows,
    );

    return consumptionSummary.rows.length > 0
      ? {
        supplyType: "ELECTRICIDAD",
        consumptionSummary,
      }
      : null;
  }

  if (!data || data.tipoSuministro !== "GAS" || !data.consumos) {
    return null;
  }

  const consumptionSummary = summarizeGasConsumption(data.consumos.rows);

  return consumptionSummary.rows.length > 0
    ? {
      supplyType: "GAS",
      consumptionSummary,
    }
    : null;
}

function getEmptyConsumptionMessage(mode: SipsSupplyMode): string {
  if (mode === "AUTO") {
    return "SIPS no devolvio consumos de luz ni gas para este CUPS.";
  }

  return `SIPS no devolvio consumos de ${getSupplyTypeLabel(
    mode,
  ).toLowerCase()} para este CUPS.`;
}

function getSupplyTypeLabel(supplyType: ApoloSipsSupplyType): string {
  return supplyType === "ELECTRICIDAD" ? "Luz" : "Gas";
}

function formatValue(value: number): string {
  return NUMBER_FORMAT.format(value);
}

function getElectricityTariffType(
  rows: ApoloSipsElectricityConsumptionRow[],
): string | null {
  const rawCode = rows
    .find((row) => row.codigoTarifaATR?.trim())
    ?.codigoTarifaATR?.trim();

  if (!rawCode) return null;

  return TARIFF_TYPE_BY_ATR_CODE[rawCode] ?? rawCode;
}

function getGasTariffType(rows: ApoloSipsGasConsumptionRow[]): string | null {
  const rawCode = rows
    .find((row) => row.codigoTarifaPeaje?.trim())
    ?.codigoTarifaPeaje?.trim();

  return rawCode || null;
}
