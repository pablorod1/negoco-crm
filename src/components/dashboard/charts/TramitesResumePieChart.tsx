"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";
import { Label, Pie, PieChart } from "recharts";

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
  { type: "active", value: 200, fill: "var(--success-color)" },
  { type: "pending", value: 287, fill: "var(--warning-color)" },
];

const chartConfig = {
  tramites: {
    label: "Tramites",
  },

  active: {
    label: "Activos",
    color: "hsl(var(--chart-2))",
  },
  pending: {
    label: "Pendientes",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export function TramitesResumePieChart() {
  const totalTramites = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, []);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-xl text-[var(--primary-color-800)]">
          Resumen de Ventas
        </CardTitle>
        <CardDescription>20 Ene - 27 Ene 2025</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartLegend content={<ChartLegendContent />} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="type"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-4xl font-bold text-[var(--primary-color-950)]"
                        >
                          {totalTramites.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Tramites
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-center gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          <span>Tus ventas han aumentado un 5,2%</span>
          <TrendingUp stroke="var(--success-color)" className="size-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Mostrando trámites de la última semana
        </div>
      </CardFooter>
    </Card>
  );
}
