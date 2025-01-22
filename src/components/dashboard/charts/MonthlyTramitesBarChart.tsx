"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

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
import { DateRangePicker } from "../DateRangePicker";
const chartData = [
  { month: "Enero", active: 222, pending: 150 },
  { month: "Febrero", active: 97, pending: 180 },
  { month: "Marzo", active: 167, pending: 120 },
  { month: "Abril", active: 242, pending: 260 },
  { month: "Mayo", active: 373, pending: 290 },
  { month: "Junio", active: 301, pending: 340 },
  { month: "Julio", active: 245, pending: 180 },
  { month: "Agosto", active: 409, pending: 320 },
  { month: "Septiembre", active: 59, pending: 110 },
  { month: "Octubre", active: 261, pending: 190 },
  { month: "Noviembre", active: 327, pending: 350 },
  { month: "Diciembre", active: 292, pending: 210 },
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

export function MonthlyTramitesBarChart() {
  const [timeRange, setTimeRange] = React.useState("90d");

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle className="text-xl text-[var(--primary-color-800)]">
            Resumen de tus ventas
          </CardTitle>
          <CardDescription>Mostrando las ventas de 2025</CardDescription>
        </div>
        <DateRangePicker />
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Este mes" />
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
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
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
                  indicator="dot"
                />
              }
            />
            <defs>
              <linearGradient id="fillPending" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--warning-color)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--bg-warning)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--success-color)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--bg-success)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="active"
              type="natural"
              fill="url(#fillActive)"
              fillOpacity={0.4}
              stroke="var(--success-color)"
              stackId="a"
            />
            <Area
              dataKey="pending"
              type="natural"
              fill="url(#fillPending)"
              fillOpacity={0.4}
              stroke="var(--warning-color)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
