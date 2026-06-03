"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { NumberTicker } from "@/core/components/ui/number-ticker";
import type { TimeRange, User } from "@/core/types";
import { cn } from "@/core/utils";
import {
  ALL_COMMERCIALS_VALUE,
  buildMetricsParams,
  getFilterDescription,
  MetricsFilterControls,
} from "./MetricsFilterControls";

interface TicketComisionData {
  ticketMedio: number;
  comisionMediaPagada: number;
  ticketComisionSeries: {
    field: string;
    ticketMedio: number;
    comisionMediaPagada: number;
  }[];
}

interface TicketComisionMediaCardProps {
  loading: boolean;
  userData: User;
  hasSubComerciales?: boolean;
}

const emptyData: TicketComisionData = {
  ticketMedio: 0,
  comisionMediaPagada: 0,
  ticketComisionSeries: [],
};

export function TicketComisionMediaCard({
  loading,
  userData,
  hasSubComerciales,
}: TicketComisionMediaCardProps) {
  const [data, setData] = React.useState<TicketComisionData>(emptyData);
  const [timeRange, setTimeRange] = React.useState<TimeRange>("year");
  const [dateRange, setDateRange] = React.useState<DateRange>();
  const [selectedCommercialId, setSelectedCommercialId] = React.useState(
    ALL_COMMERCIALS_VALUE,
  );
  const [fetching, setFetching] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setFetching(true);
    setIsRefreshing(true);

    try {
      const params = buildMetricsParams({
        userData,
        selectedCommercialId,
        timeRange,
        dateRange,
      });
      const res = await fetch(`/api/v2/analytics/metrics?${params}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Error al obtener métricas");
      }

      setData(json.data as TicketComisionData);
    } catch (error) {
      console.error("Error al obtener ticket y comisión media:", error);
      setData(emptyData);
    } finally {
      setFetching(false);
      setIsRefreshing(false);
    }
  }, [dateRange, selectedCommercialId, timeRange, userData]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isLoading = loading || fetching;

  return (
    <Card
      variant="dashboard"
      className={cn("lg:col-span-3", loading && "opacity-60")}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm text-gray-500">
            Ticket y Comisión Media
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 font-extralight">
            {getFilterDescription(timeRange, dateRange)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={fetchData}
            disabled={loading || isRefreshing}
            aria-label="Actualizar datos"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
          </Button>
          <MetricsFilterControls
            userData={userData}
            loading={loading}
            hasSubComerciales={hasSubComerciales}
            selectedCommercialId={selectedCommercialId}
            onCommercialChange={setSelectedCommercialId}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">Ticket Medio</p>
            <p className="text-2xl font-bold">
              {isLoading ? (
                "—"
              ) : (
                <NumberTicker
                  value={data.ticketMedio}
                  decimalPlaces={2}
                  endContent="€"
                />
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Comisión Media Pagada</p>
            <p className="text-2xl font-bold">
              {isLoading ? (
                "—"
              ) : (
                <NumberTicker
                  value={data.comisionMediaPagada}
                  decimalPlaces={2}
                  endContent="€"
                />
              )}
            </p>
          </div>
        </div>
        {data.ticketComisionSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={data.ticketComisionSeries}
              margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                vertical={false}
                strokeDasharray="4 4"
                stroke="var(--primary-color-100)"
              />
              <XAxis
                dataKey="field"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                stroke="#6b7280"
                fontSize={11}
                className="text-gray-500"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={44}
                stroke="#6b7280"
                fontSize={11}
                className="text-gray-500"
              />
              <Tooltip
                content={(props) => {
                  if (!props.active || !props.payload) return null;
                  return (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
                      <p className="mb-2 font-medium text-gray-900">
                        {props.label}
                      </p>
                      {props.payload.map((entry) => (
                        <div
                          key={String(entry.dataKey)}
                          className="mb-1 flex items-center justify-between gap-4"
                        >
                          <span className="text-gray-600">
                            {String(entry.dataKey) === "ticketMedio"
                              ? "Ticket medio"
                              : "Comisión media pagada"}
                          </span>
                          <span className="font-medium text-gray-900">
                            {Number(entry.value).toFixed(2)}€
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="ticketMedio"
                stroke="var(--primary-color-500)"
                fill="var(--primary-color-500)"
                fillOpacity={0.12}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="comisionMediaPagada"
                stroke="var(--primary-color-300)"
                fill="var(--primary-color-300)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-gray-400">Sin datos</p>
        )}
      </CardContent>
    </Card>
  );
}
