"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import React from "react";
import { getMonthlyComisiones } from "@/lib/libsql/data/tramites/getTramites";
import { Euro } from "lucide-react";
import { User } from "@/lib/core/types";

const chartConfig = {
  comision: {
    icon: Euro,
    label: "Comisión",
    color: "var(--primary-color-500)",
  },
} satisfies ChartConfig;

const createEmptyData = () => {
  return Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2025, i).toLocaleString("default", { month: "long" }),
    comision: 0,
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
    React.useState<{ month: string; comision: number }[]>(createEmptyData);

  // Función para obtener los datos de comisiones
  const fetchComisiones = React.useCallback(async () => {
    if (!loading) {
      try {
        const rs = await getMonthlyComisiones(userData);
        setChartData((prev) => {
          return prev.map((item) => {
            // Convertimos el nombre del mes a formato que coincida con los datos de rs
            const data = rs.find((r) =>
              r.month.toLowerCase().includes(item.month.toLowerCase())
            );

            if (data) {
              return {
                ...item,
                comision: data.total,
              };
            }
            return item;
          });
        });
      } catch (error) {
        console.error("Error al obtener comisiones:", error);
      }
    }
  }, [userData, loading]);

  React.useEffect(() => {
    fetchComisiones();
  }, [fetchComisiones]);

  return (
    <Card
      className={`relative h-full backdrop-blur-lg border-0 shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-colors duration-300 ${
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
        <CardTitle className="text-xl text-[var(--primary-color-800)]">
          Resumen de Comisiones 2025
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`transition-opacity duration-300${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        {!loading && chartData.length > 0 && (
          <ChartContainer
            className="aspect-auto h-[100px] w-full overflow-visible"
            config={chartConfig}
          >
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 12, right: 12 }}
              height={100}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 3)}
                className="capitalize"
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent className="capitalize" indicator="dot" />
                }
              />
              <defs>
                <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--primary-color-400)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--primary-color-600)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <Area
                dataKey="comision"
                type="monotone"
                fill="url(#fillDesktop)"
                fillOpacity={0.4}
                stroke="var(--primary-color-500)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
