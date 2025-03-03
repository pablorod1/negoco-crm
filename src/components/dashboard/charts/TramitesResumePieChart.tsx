"use client";

import * as React from "react";
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
import { getActivePendingTramites } from "@/lib/libsql/data/tramites/getTramites";
import { User } from "@/lib/core/types";
import { Spinner } from "@heroui/react";

const chartConfig = {
  tramites: {
    label: "Tramites",
  },
  active: {
    label: "Activos",
    color: "var(--primary-color-700)",
  },
  pending: {
    label: "Pendientes",
    color: "var(--primary-color-400)",
  },
} satisfies ChartConfig;

const pieData = [
  {
    id: "active",
    type: "active",
    label: "Activos",
    fill: "var(--primary-color-700)",
  },
  {
    id: "pending",
    type: "pending",
    label: "Pendientes",
    fill: "var(--primary-color-400)",
  },
];

interface Data {
  total: number;
  active: {
    value: number;
    difference: number;
  };
  pending: {
    value: number;
    difference: number;
  };
}

export function TramitesResumePieChart({
  userData,
  loading,
}: {
  userData: User;
  loading: boolean;
}) {
  const [tramites, setTramites] = React.useState<Data>();
  const [currentWeek, setCurrentWeek] = React.useState<string>("");
  const [activePercentage, setActivePercentage] = React.useState<number>(0);
  const [loadingData, setLoadingData] = React.useState<boolean>(true);

  const getCurrentWeek = React.useCallback(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

    // Calcular la fecha del lunes de la semana actual
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - dayOfWeek + 1); // Restar el número de días hasta llegar al lunes

    // Calcular la fecha del domingo de la semana actual
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // Sumar 6 días para obtener el domingo

    // Formatear las fechas de inicio y fin de la semana
    const firstDayFormatted = firstDayOfWeek.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
    const lastDayFormatted = lastDayOfWeek.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });

    // Concatenar el rango de fechas para mostrar
    const currentWeek = `${firstDayFormatted} - ${lastDayFormatted} ${today.getFullYear()}`;
    setCurrentWeek(currentWeek);
  }, []);

  const getCompletionMessage = (activePercentage: number): string => {
    if (activePercentage >= 100) {
      return "🎉 ¡Felicidades! Has completado todos tus trámites. 🎉";
    }
    if (activePercentage >= 80) {
      return "¡Buen trabajo! Estás cerca de completar todos tus trámites. 👍";
    }
    if (activePercentage >= 50) {
      return "Vas por buen camino, sigue así para completar más trámites. 🚀";
    }
    return "Aún tienes algunos trámites por completar. ¡Ánimo! 💪";
  };

  const calculateActivePercentage = (tramites: Data): number => {
    const total = tramites.total;
    const active = tramites.active.value;
    return (active / total) * 100;
  };

  const fetchTramites = React.useCallback(async () => {
    setLoadingData(true);
    try {
      const data = await getActivePendingTramites(true, userData);
      setTramites(data);
      setActivePercentage(calculateActivePercentage(data));
    } catch (error) {
      console.error("Error al obtener trámites:", error);
    } finally {
      setTimeout(() => setLoadingData(false), 300);
    }
  }, [userData]);

  React.useEffect(() => {
    fetchTramites();
    getCurrentWeek();
  }, [fetchTramites, getCurrentWeek]);

  const chartData = React.useMemo(() => {
    if (tramites) {
      return pieData.map((item) => {
        const value =
          item.type === "active"
            ? tramites.active.value
            : tramites.pending.value;
        return {
          ...item,
          value,
        };
      });
    }
  }, [tramites]);

  return (
    <Card
      className={`flex flex-col relative h-full border-0 backdrop-blur-lg  shadow-[0_2px_6px_rgba(0,0,0,0.1)] transition-colors duration-300 ${
        loading ? "bg-gray-200 " : "bg-white "
      } `}
    >
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader
        className={` items-center pb-0 transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <CardTitle className="text-xl text-[var(--primary-color-800)] text-center">
          Resumen de Ventas
        </CardTitle>
        <CardDescription className="text-center">{currentWeek}</CardDescription>
      </CardHeader>
      <CardContent
        className={` flex-1 pb-0 transition-opacity duration-500  ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        {tramites && (tramites.active.value || tramites.pending.value) ? (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartLegend
                content={<ChartLegendContent />}
                layout="horizontal"
                align="center"
              />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
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
                            {tramites.total.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            Trámites
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : !loading && loadingData ? (
          <div className="w-full h-full flex justify-center items-center">
            <Spinner size="lg" label="Cargando..." color="primary" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <svg
                fill="#ffffff"
                width="120px"
                height="120px"
                viewBox="0 0 24.00 24.00"
                id="chart-pie"
                data-name="Flat Color"
                xmlns="http://www.w3.org/2000/svg"
                className="icon flat-color"
              >
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g
                  id="SVGRepo_tracerCarrier"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="#CCCCCC"
                  strokeWidth="0.048"
                ></g>
                <g id="SVGRepo_iconCarrier">
                  <ellipse
                    id="secondary"
                    cx="10.22"
                    cy="13.78"
                    rx="8.25"
                    ry="8.17"
                    transform="translate(-6.75 11.26) rotate(-45)"
                    fill="#3b82f6"
                  ></ellipse>
                  <path
                    id="primary"
                    d="M22,14a12,12,0,0,1-2.12,6.81A1,1,0,0,1,18.4,21l-8-6.72a1,1,0,0,1-.36-.77V3.05a1,1,0,0,1,1.11-1A12,12,0,0,1,22,14Z"
                    fill="#172e54"
                  ></path>
                </g>
              </svg>
              <span className="font-medium text-muted-foreground text-center">
                No hay trámites para mostrar
              </span>
            </div>
          </div>
        )}
      </CardContent>
      {tramites ? (
        <CardFooter
          className={`flex-col items-center gap-2 text-sm transition-opacity duration-300 ${
            loading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-2 font-medium leading-none text-center">
            <span className="text-sm text-gray-600">
              {getCompletionMessage(activePercentage)}
            </span>
          </div>
          <div className="leading-none text-gray-500 text-xs">
            Mostrando trámites de la última semana
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
