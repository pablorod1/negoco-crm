"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarIcon, RefreshCw, Users } from "lucide-react";

import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader } from "@/core/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/core/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/core/components/ui/select";
import { Button } from "@/core/components/ui/button";
import { NumberTicker } from "@/core/components/ui/number-ticker";
import type { User } from "@/core/types";
import { cn } from "@/core/utils";
import LoadingStateCard from "../LoadingStateCard";

const ALL_COMMERCIALS_VALUE = "all";

interface ComparativasData {
  total: number;
  processed: number;
}

interface CommercialOption {
  id: string;
  name: string;
  image: string | null;
}

interface MonthOption {
  value: string;
  label: string;
}

interface ComparativasRatioProps {
  userData: User;
  loading: boolean;
  hasSubComerciales?: boolean;
}

const createMonthOptions = (): MonthOption[] => {
  const currentYear = new Date().getFullYear();

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const date = new Date(currentYear, monthIndex, 1);
    const monthName = date.toLocaleString("es-ES", { month: "long" });
    const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return {
      value: `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      label,
    };
  });
};

const getCurrentMonthValue = () => {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1,
  ).padStart(2, "0")}-01`;
};

const calculateProcessedPercentage = (data: ComparativasData): number => {
  const conversionBase = data.total + data.processed;
  if (conversionBase === 0) return 0;
  return Math.round((data.processed / conversionBase) * 100);
};

const gaugeChartConfig = {
  filled: { label: "Completadas", color: "#10b981" },
  unfilled: { label: "En estudio", color: "#f3f4f6" },
} satisfies ChartConfig;

const RadialGauge = ({ percentage }: { percentage: number }) => {
  const gaugeData = [
    { name: "filled", value: percentage, fill: "var(--color-primary)" },
    { name: "unfilled", value: 100 - percentage, fill: "#f3f4f6" },
  ];

  return (
    <ChartContainer
      config={gaugeChartConfig}
      className="absolute inset-0 aspect-auto h-full w-full"
    >
      <PieChart>
        <Pie
          data={gaugeData}
          dataKey="value"
          startAngle={210}
          endAngle={-30}
          innerRadius="72%"
          outerRadius="88%"
          strokeWidth={0}
          isAnimationActive
          animationDuration={1300}
          animationEasing="ease-out"
          className="rounded-full"
        >
          {gaugeData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};

interface MetricCellProps {
  value: number;
  label: string;
  accentClass: string;
  delay?: number;
}

const MetricCell = ({
  value,
  label,
  accentClass,
  delay = 0,
}: MetricCellProps) => (
  <motion.div
    className="flex flex-col gap-2 px-5 py-5"
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
  >
    <span className="text-2xl font-bold tabular-nums leading-none tracking-tight text-gray-950">
      {value ? <NumberTicker value={value} /> : 0}
    </span>
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <div className={cn("h-0.5 w-5 rounded-full", accentClass)} />
    </div>
  </motion.div>
);

export function ComparativasRatio({
  userData,
  loading,
  hasSubComerciales = false,
}: ComparativasRatioProps) {
  const monthOptions = React.useMemo(() => createMonthOptions(), []);
  const [comparativasData, setComparativasData] =
    React.useState<ComparativasData | null>(null);
  const [selectedMonth, setSelectedMonth] =
    React.useState<string>(getCurrentMonthValue);
  const [selectedCommercialId, setSelectedCommercialId] =
    React.useState<string>(ALL_COMMERCIALS_VALUE);
  const [commercialOptions, setCommercialOptions] = React.useState<
    CommercialOption[]
  >([]);
  const [loadingData, setLoadingData] = React.useState<boolean>(true);
  const [loadingCommercials, setLoadingCommercials] =
    React.useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  const showCommercialFilter =
    userData.role === "admin" ||
    userData.role === "1" ||
    (userData.role === "2" && hasSubComerciales);

  const fetchCommercialOptions = React.useCallback(async () => {
    if (!showCommercialFilter) {
      setCommercialOptions([]);
      setSelectedCommercialId(ALL_COMMERCIALS_VALUE);
      return;
    }

    setLoadingCommercials(true);

    try {
      const params = new URLSearchParams({ role: userData.role });

      const res = await fetch(`/api/v2/users/${userData.id}/all?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const { data, success, error } = await res.json();

      if (!success) {
        throw new Error(error || "Error al obtener comerciales");
      }

      const options = Array.isArray(data)
        ? (data as User[]).map((user) => ({
            id: user.id,
            name: user.name,
            image: user.image,
          }))
        : [];

      setCommercialOptions(options);
      setSelectedCommercialId((currentValue) => {
        if (currentValue === ALL_COMMERCIALS_VALUE) return currentValue;
        return options.some((opt) => opt.id === currentValue)
          ? currentValue
          : ALL_COMMERCIALS_VALUE;
      });
    } catch (err) {
      console.error("Error al obtener comerciales:", err);
      setCommercialOptions([]);
      setSelectedCommercialId(ALL_COMMERCIALS_VALUE);
    } finally {
      setLoadingCommercials(false);
    }
  }, [showCommercialFilter, userData.id, userData.role]);

  const fetchComparativas = React.useCallback(async () => {
    if (!selectedMonth) return;

    setLoadingData(true);
    setIsRefreshing(true);

    try {
      const params = new URLSearchParams({
        metric: "converted-ratio",
        id: userData.id,
        role: userData.role,
        month: selectedMonth,
      });

      if (selectedCommercialId !== ALL_COMMERCIALS_VALUE) {
        params.set("commercialId", selectedCommercialId);
      }

      const res = await fetch(`/api/v2/analytics/comparisons?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const { data, success, error } = await res.json();

      if (!success) {
        throw new Error(error || "Error al obtener comparativas");
      }

      if (Array.isArray(data) && data.length > 0) {
        setComparativasData(data[0] as ComparativasData);
      } else {
        setComparativasData(null);
      }
    } catch (err) {
      console.error("Error al obtener comparativas:", err);
      setComparativasData(null);
    } finally {
      setLoadingData(false);
      setIsRefreshing(false);
    }
  }, [selectedCommercialId, selectedMonth, userData.id, userData.role]);

  React.useEffect(() => {
    fetchCommercialOptions();
  }, [fetchCommercialOptions]);

  React.useEffect(() => {
    fetchComparativas();
  }, [fetchComparativas]);

  const selectedMonthLabel = React.useMemo(
    () =>
      monthOptions.find((opt) => opt.value === selectedMonth)?.label ??
      "Seleccionar mes",
    [monthOptions, selectedMonth],
  );

  const selectedCommercialLabel = React.useMemo(() => {
    if (selectedCommercialId === ALL_COMMERCIALS_VALUE) return "Todos";
    return (
      commercialOptions.find((opt) => opt.id === selectedCommercialId)?.name ??
      "Comercial"
    );
  }, [commercialOptions, selectedCommercialId]);

  const completed = comparativasData?.total ?? 0;
  const processed = comparativasData?.processed ?? 0;
  const conversionBase = completed + processed;
  const processedPercentage = comparativasData
    ? calculateProcessedPercentage(comparativasData)
    : 0;
  const hasActivity = conversionBase > 0;

  const refreshData = () => {
    fetchComparativas();
    fetchCommercialOptions();
  };

  return (
    <Card
      variant="dashboard"
      className={cn("overflow-hidden", loading ? "opacity-60" : "")}
    >
      {loading && (
        <div className="absolute inset-0 z-10 rounded-lg bg-gray-50/50" />
      )}

      {/* Header */}
      <CardHeader
        className={cn(
          "relative z-10 flex flex-row items-center justify-between border-b border-gray-100 px-6 py-4 transition-opacity duration-200",
          loading ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">
            Análisis mensual
          </p>
          <h3 className="text-sm font-semibold text-gray-900">
            Ratio de Conversión
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {showCommercialFilter && (
            <Select
              disabled={loading || loadingCommercials}
              value={selectedCommercialId}
              onValueChange={setSelectedCommercialId}
            >
              <SelectTrigger className="h-8 gap-1.5 border-gray-200 px-2.5 text-xs text-gray-500">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[80px] truncate">
                  {selectedCommercialLabel}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMMERCIALS_VALUE}>
                  Todos los comerciales
                </SelectItem>
                {commercialOptions.map((commercial) => (
                  <SelectItem key={commercial.id} value={commercial.id}>
                    {commercial.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            disabled={loading || monthOptions.length === 0}
            value={selectedMonth}
            onValueChange={setSelectedMonth}
          >
            <SelectTrigger className="h-8 gap-1.5 border-gray-200 px-2.5 text-xs text-gray-500">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{selectedMonthLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-md p-0 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            onClick={refreshData}
            disabled={loading || isRefreshing}
            aria-label="Actualizar datos"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent
        className={cn(
          "relative z-10 flex-1 p-0 transition-opacity duration-200",
          loading ? "opacity-0" : "opacity-100",
        )}
      >
        <AnimatePresence mode="wait">
          {!loading && loadingData ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-64 items-center justify-center"
            >
              <LoadingStateCard />
            </motion.div>
          ) : !loading && !hasActivity ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex min-h-64 flex-col items-center justify-center gap-2 px-8 text-center"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-300">
                Sin actividad
              </p>
              <p className="text-sm text-gray-400">
                No hay comparativas en {selectedMonthLabel}
                {showCommercialFilter &&
                selectedCommercialId !== ALL_COMMERCIALS_VALUE
                  ? ` · ${selectedCommercialLabel}`
                  : ""}
              </p>
            </motion.div>
          ) : comparativasData ? (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Hero: radial gauge with percentage inside */}
              <div className="flex flex-col items-center px-6 pb-6 pt-8">
                <div className="relative flex h-52 w-52 items-center justify-center">
                  <RadialGauge percentage={processedPercentage} />

                  {/* Number centred inside the gauge */}
                  <div className="relative flex flex-col items-center text-center">
                    <motion.div
                      className="flex items-end gap-0.5 leading-none"
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <span className="text-5xl font-black tabular-nums leading-[0.85] tracking-tighter text-gray-950">
                        <NumberTicker
                          value={processedPercentage}
                          className="text-gray-950"
                        />
                      </span>
                      <span className="mb-1 self-end text-2xl font-black leading-none text-gray-300">
                        %
                      </span>
                    </motion.div>

                    <motion.p
                      className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                    >
                      conversión
                    </motion.p>
                  </div>
                </div>

                <motion.p
                  className="mt-2 text-xs text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  {conversionBase}{" "}
                  {conversionBase === 1 ? "comparativa" : "comparativas"} ·{" "}
                  {selectedMonthLabel}
                </motion.p>
              </div>

              {/* Divider */}
              <div className="h-px w-full bg-gray-100" />

              {/* Metrics row */}
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                <MetricCell
                  value={processed}
                  label="Convertidas a trámite"
                  accentClass="bg-emerald-500"
                  delay={0.1}
                />
                <MetricCell
                  value={completed}
                  label="Estudio realizado"
                  accentClass="bg-slate-300"
                  delay={0.18}
                />
                <MetricCell
                  value={conversionBase}
                  label="Total"
                  accentClass="bg-gray-200"
                  delay={0.26}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
