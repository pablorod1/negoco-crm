"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const chartData = [
  { comercial: "Comercial 1", active: 222, pending: 150 },
  { comercial: "Comercial 2", active: 97, pending: 180 },
  { comercial: "Comercial 3", active: 167, pending: 120 },
  { comercial: "Comercial 4", active: 242, pending: 260 },
  { comercial: "Comercial 5", active: 373, pending: 290 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
  { comercial: "Comercial 6", active: 301, pending: 340 },
];
const chartConfig = {
  tramites: {
    label: "Tramites",
  },
  active: {
    label: "Activos",
    color: "var(--success-color)",
  },
  pending: {
    label: "Pendientes",
    color: "var(--warning-color)",
  },
} satisfies ChartConfig;

export function TeamTramitesBarChart() {
  const [timeRange, setTimeRange] = React.useState("90d");
  const [comercial, setComercial] = React.useState("");

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle className="text-xl text-[var(--primary-color-800)]">
            Resumen de ventas de tu equipo
          </CardTitle>
          <CardDescription>Mostrando las ventas de 2025</CardDescription>
        </div>
        <Select value={comercial} onValueChange={setComercial}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Selecciona una opción"
          >
            <SelectValue placeholder="Vista General" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {chartData.map((data, index) => (
              <SelectItem
                key={index}
                value={data.comercial}
                className="rounded-lg"
              >
                {data.comercial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Este año
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Este mes
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Esta semana
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="comercial"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  labelKey="tramites"
                />
              }
            />
            <Bar dataKey="active" fill="var(--success-color)" radius={4} />
            <Bar dataKey="pending" fill="var(--warning-color)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
