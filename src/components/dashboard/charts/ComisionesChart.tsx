"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
const chartData = [
  { month: "Enero", comision: 186 },
  { month: "Febrero", comision: 305 },
  { month: "Marzo", comision: 237 },
  { month: "Abril", comision: 73 },
  { month: "Mayo", comision: 209 },
  { month: "Junio", comision: 214 },
  { month: "Julio", comision: 273 },
  { month: "Agosto", comision: 303 },
  { month: "Septiembre", comision: 331 },
  { month: "Octubre", comision: 220 },
  { month: "Noviembre", comision: 190 },
  { month: "Diciembre", comision: 120 },
];

const chartConfig = {
  comision: {
    label: "Comision",
    color: "var(--primary-color-500)",
  },
} satisfies ChartConfig;

export function ComisionesChart() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl text-[var(--primary-color-800)]">
          Resumen de Comisiones 2025
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-[100px] w-full" config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
            height={100}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
              type="natural"
              fill="url(#fillDesktop)"
              fillOpacity={0.4}
              stroke="var(--primary-color-500)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
