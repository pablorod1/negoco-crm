"use client";
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
import React from "react";
import { getMonthlyActivePendingTramites } from "@/lib/libsql/data/tramites/getTramites";

const chartConfig: ChartConfig = {
  tramites: { label: "Trámites" },
  active: { label: "Activos", color: "var(--primary-color-700)" },
  pending: { label: "Pendientes", color: "var(--primary-color-400)" },
};

// Generar un array con los 12 meses en español, asegurando que siempre hay datos.
const createEmptyData = () =>
  Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2025, i).toLocaleString("es-ES", { month: "long" }),
    active: 0,
    pending: 0,
  }));

export function YearlyTramitesBarChart({ loading }: { loading: boolean }) {
  const [chartData, setChartData] = React.useState(createEmptyData);

  React.useEffect(() => {
    const fetchTramites = async () => {
      try {
        const data = await getMonthlyActivePendingTramites();
        setChartData(data);
      } catch (error) {
        console.error("Error al obtener trámites:", error);
      }
    };
    fetchTramites();
  }, []);

  const getActiveTramitesPercentageChange = (
    data: { month: string; active: number }[]
  ) => {
    const currentMonthIndex = new Date().getMonth(); // Índice del mes actual (0 = Enero, 11 = Diciembre)
    const previousMonthIndex =
      currentMonthIndex === 0 ? 11 : currentMonthIndex - 1; // Mes anterior (manejo de diciembre a enero)

    const currentMonthData = data.find((item) =>
      item.month
        .toLowerCase()
        .startsWith(
          new Date(2025, currentMonthIndex)
            .toLocaleString("es-ES", { month: "long" })
            .toLowerCase()
        )
    );

    const previousMonthData = data.find((item) =>
      item.month
        .toLowerCase()
        .startsWith(
          new Date(2025, previousMonthIndex)
            .toLocaleString("es-ES", { month: "long" })
            .toLowerCase()
        )
    );

    const currentActive = currentMonthData?.active ?? 0;
    const previousActive = previousMonthData?.active ?? 0;

    if (previousActive === 0)
      return currentActive > 0 ? currentActive * 100 : 0; // Si no había trámites antes, mostrar 100% si ahora hay más.

    return Math.round(
      ((currentActive - previousActive) / previousActive) * 100
    );
  };

  const formatDifferenceText = (percentageChange: number) => {
    if (percentageChange === 0) {
      return "📊 No hubo cambios en los trámites respecto al mes anterior. ¡Sigamos optimizando la gestión!";
    } else if (percentageChange > 0) {
      if (percentageChange < 10) {
        return `📈 Los trámites aumentaron un ${percentageChange}% en comparación con el mes pasado. Un ligero crecimiento, ¡sigamos organizando el flujo de trabajo!`;
      } else if (percentageChange < 25) {
        return `🚀 ¡Los trámites crecieron un ${percentageChange}% respecto al mes anterior! Un buen indicador de actividad, mantengamos el ritmo.`;
      } else {
        return `🔥 ¡Gran incremento del ${percentageChange}% en trámites este mes! Asegurémonos de gestionar eficazmente esta carga de trabajo.`;
      }
    } else {
      if (percentageChange > -10) {
        return `📉 Los trámites bajaron un ${Math.abs(
          percentageChange
        )}% en comparación con el mes anterior. Puede ser algo puntual, ¡sigamos atentos!`;
      } else if (percentageChange > -25) {
        return `⚠️ Se registró una caída del ${Math.abs(
          percentageChange
        )}% en los trámites este mes. Revisemos si hay factores que la expliquen.`;
      } else {
        return `🚨 Los trámites disminuyeron un ${Math.abs(
          percentageChange
        )}% respecto al mes pasado. Es importante analizar si hay cambios en la demanda o en la gestión.`;
      }
    }
  };

  return (
    <Card className="relative h-full backdrop-blur-lg border border-white/20 shadow-[0_2px_6px_rgba(0,0,0,0.14)] bg-white/80">
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-500 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>

      <CardHeader className={loading ? "opacity-0" : "opacity-100"}>
        <CardTitle className="text-xl text-[var(--primary-color-800)]">
          Resumen de Ventas 2025
        </CardTitle>
        <CardDescription className="text-xs text-gray-400">
          Tu resumen de ventas mensuales en 2025
        </CardDescription>
      </CardHeader>

      <CardContent className={loading ? "opacity-0" : "opacity-100"}>
        {chartData.length > 0 ? (
          <ChartContainer
            className="max-h-[220px] h-full w-full"
            config={chartConfig}
          >
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={true}
                tickSize={5}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
                className="capitalize"
              />
              <ChartLegend content={<ChartLegendContent />} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent labelKey="tramites" indicator="dot" />
                }
              />
              {chartData.some((data) => data.active > 0) && (
                <Bar
                  dataKey="active"
                  fill="var(--primary-color-700)"
                  radius={4}
                />
              )}
              {chartData.some((data) => data.pending > 0) && (
                <Bar
                  dataKey="pending"
                  fill="var(--primary-color-400)"
                  radius={4}
                />
              )}
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center w-full h-[200px] text-muted-foreground">
            No hay datos para mostrar
          </div>
        )}
      </CardContent>

      <CardFooter
        className={`flex-col items-start gap-2 text-sm ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-center gap-2 font-medium leading-none">
          <span className="text-sm text-gray-600">
            {formatDifferenceText(getActiveTramitesPercentageChange(chartData))}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
