"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
const chartData = [
  { month: "Enero", active: 186, pending: 80 },
  { month: "Febrero", active: 305, pending: 200 },
  { month: "Marzo", active: 237, pending: 120 },
  { month: "Abril", active: 73, pending: 190 },
  { month: "Mayo", active: 209, pending: 130 },
  { month: "Junio", active: 214, pending: 140 },
  { month: "Julio", active: 273, pending: 210 },
  { month: "Agosto", active: 303, pending: 230 },
  { month: "Septiembre", active: 331, pending: 250 },
  { month: "Octubre", active: 220, pending: 160 },
  { month: "Noviembre", active: 190, pending: 150 },
  { month: "Diciembre", active: 120, pending: 100 },
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

export function YearlyTramitesBarChart() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl text-[var(--primary-color-800)]">
          Resumen de Ventas 2025
        </CardTitle>
        <CardDescription>Enero - Diciembre</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-[200px] w-full" config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent labelKey="tramites" indicator="dot" />
              }
            />
            <Bar dataKey="active" fill="var(--success-color)" radius={4} />
            <Bar dataKey="pending" fill="var(--warning-color)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          <span className="text-gray-800">
            En enero aumentaron las ventas un 15%
          </span>
          <TrendingUp className="h-4 w-4" stroke="var(--success-color)" />
        </div>
        <div className="leading-none text-muted-foreground">
          Tramites totales en 2025
        </div>
      </CardFooter>
    </Card>
  );
}
