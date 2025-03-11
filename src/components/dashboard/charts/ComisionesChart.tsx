"use client";

import { Line, LineChart, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import React from "react";
import { Euro } from "lucide-react";
import { User } from "@/lib/core/types";
import { formatComission } from "@/lib/core/format";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Spinner } from "@heroui/react";

const chartConfig = {
  total: {
    icon: Euro,
    label: "Comisión",
    color: "var(--primary-color-500)",
  },
} satisfies ChartConfig;

const createEmptyData = () => {
  return Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2025, i).toLocaleString("default", { month: "long" }),
    total: 0,
  }));
};

export function ComisionesChart({
  userData,
  loading,
}: {
  userData: User;
  loading: boolean;
}) {
  const [chartData, setChartData] =
    React.useState<{ month: string; total: number }[]>(createEmptyData);
  const [loadingData, setLoadingData] = React.useState(true);

  // Función para obtener los datos de comisiones
  const fetchComisiones = React.useCallback(async () => {
    if (!loading) {
      try {
        const res = await fetch(
          `
          /api/tramites/get/monthly-comisiones
          `,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: userData.id, role: userData.role }),
          }
        );
        const { success, data, error } = await res.json();

        if (!success && error) {
          throw new Error(error);
        }
        setChartData(data);
      } catch (error) {
        console.error("Error al obtener comisiones:", error);
      } finally {
        setLoadingData(false);
      }
    }
  }, [userData, loading]);

  React.useEffect(() => {
    fetchComisiones();
  }, [fetchComisiones]);

  const calculateDifference = () => {
    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const currentTotal = chartData[currentMonth].total;
    const lastTotal = chartData[lastMonth].total;
    const difference =
      ((currentTotal - lastTotal) / lastTotal) * 100 === Infinity
        ? 100
        : ((currentTotal - lastTotal) / lastTotal) * 100;
    return difference;
  };

  const currentMonthComision = chartData[new Date().getMonth()].total;
  const difference = calculateDifference();

  return (
    <Card
      className={`relative flex flex-col justify-between h-full backdrop-blur-lg border-0 shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-colors duration-300 ${
        loading ? "bg-gray-200 " : "bg-white"
      }`}
    >
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>

      {/* Contenido de la tarjeta */}
      <CardHeader
        className={`transition-opacity duration-300${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="space-y-1 mb-2">
          <h2 className="text-sm font-medium text-[var(--primary-color-300)]">
            Total Comisiones
          </h2>

          {!loadingData ? (
            <>
              <NumberTicker
                endContent="€"
                value={currentMonthComision}
                decimalPlaces={2}
                className="text-3xl font-bold text-[var(--primary-color-800)]"
              >
                {formatComission(currentMonthComision)}
              </NumberTicker>

              <p
                className={`text-sm ${
                  difference >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {difference >= 0 ? "+" : ""}
                {difference.toFixed(1)}% respecto al mes anterior
              </p>
            </>
          ) : (
            <div className="h-12 w-24 bg-gray-200 rounded-md animate-pulse"></div>
          )}
        </div>
      </CardHeader>
      <CardContent
        className={`transition-opacity duration-300${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        {!loadingData ? (
          <ChartContainer
            config={chartConfig}
            className=" max-h-[200px] h-full w-full py-4"
          >
            <LineChart accessibilityLayer data={chartData}>
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tickFormatter={(value) => value.slice(0, 3)}
              />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              <Line
                dataKey="total"
                type="monotone"
                stroke="var(--primary-color-500)"
                strokeWidth={2}
                dot={{
                  fill: "var(--primary-color-500)",
                }}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className=" h-full w-full flex justify-center items-center">
            <Spinner
              size="lg"
              color="primary"
              variant="gradient"
              label="Cargando..."
            />
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-gray-300">
          * Comisiones acumuladas en el último año
        </p>
      </CardFooter>
    </Card>
  );
}
