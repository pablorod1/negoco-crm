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
import { User } from "@/lib/core/types";
import {
  getActiveTramitesByUserID,
  getTeamTramites,
} from "@/lib/libsql/data/tramites/getTramites";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

interface Data {
  user: Partial<User>;
  active: number;
}

export function TeamTramitesBarChart({
  userData,
  loading,
}: {
  userData: User;
  loading: boolean;
}) {
  const [selectedComercial, setSelectedComercial] =
    React.useState<string>("all");
  const [chartData, setChartData] = React.useState<Data[]>([] as Data[]);
  const [timeRange, setTimeRange] = React.useState<
    "year" | "current_month" | "current_week" | "last_week" | "90d" | undefined
  >("year");
  const [comerciales, setComerciales] = React.useState<User[]>([]);

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(
      value as "year" | "current_month" | "current_week" | "last_week" | "90d"
    );
  };

  const fetchTramites = React.useCallback(async () => {
    try {
      if (selectedComercial === "all") {
        const data = await getTeamTramites(userData);
        setChartData(data as Data[]);
        setComerciales([...data.map((item) => item.user as User)]);
      } else {
        const rawData = await getActiveTramitesByUserID(
          { id: selectedComercial, role: "2" },
          timeRange
        );
        const transformedData: Data[] = rawData.map((item) => ({
          user: { name: item.field },
          active: item.value,
        }));
        setChartData(transformedData);
      }
    } catch (error) {
      console.error("Error al obtener trámites:", error);
    }
  }, [userData, selectedComercial, timeRange]);

  React.useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  const getDescription = () => {
    switch (timeRange) {
      case "year":
        const date = new Date();
        const year = date.getFullYear();
        return `Mostrando las ventas de ${year}`;
      case "current_month":
        const month = new Date().toLocaleString("default", { month: "long" });
        return `Mostrando las ventas de ${month}`;
      case "current_week":
        return "Mostrando las ventas de esta semana";
      case "last_week":
        return "Mostrando las ventas de la semana pasada";
      case "90d":
        return "Mostrando las ventas de los últimos 90 días";
      default:
        return "Mostrando las ventas de 2025";
    }
  };

  return (
    <Card
      className={`relative w-full h-full backdrop-blur-lg border-0 shadow-[0_2px_6px_rgba(0,0,0,0.1)] group transition-colors duration-300 ${
        loading ? "bg-gray-200" : "bg-white"
      }`}
    >
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader
        className={`flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle className="text-xl text-[var(--primary-color-800)]">
            Resumen de ventas de tu equipo
          </CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </div>
        <Select value={selectedComercial} onValueChange={setSelectedComercial}>
          <SelectTrigger
            className="w-[260px] rounded-lg sm:ml-auto py-2"
            aria-label="Selecciona una opción"
          >
            <SelectValue placeholder="Vista General" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" key="all" className="rounded-lg mb-2">
              Vista General
            </SelectItem>
            {comerciales.map((comercial) => (
              <SelectItem
                key={comercial.id}
                value={comercial.id}
                textValue={comercial.name}
                className="rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={comercial.image as string}
                      alt={comercial.name}
                    />
                    <AvatarFallback className="rounded-lg bg-[var(--primary-color-100)] text-[var(--primary-color-800)]">
                      {comercial.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{comercial.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={timeRange} onValueChange={handleTimeRangeChange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto "
            aria-label="Select a value"
          >
            <SelectValue placeholder="Este mes" />
          </SelectTrigger>
          <SelectContent className="rounded-xl ">
            <SelectItem key="year" value="year" className="rounded-lg">
              Este año
            </SelectItem>
            <SelectItem value="90d" className="rounded-lg" key="90d">
              Últimos 90 días
            </SelectItem>
            <SelectItem
              value="current_month"
              className="rounded-lg"
              key="current_month"
            >
              Este mes
            </SelectItem>
            <SelectItem
              value="current_week"
              className="rounded-lg"
              key="current_week"
            >
              Esta semana
            </SelectItem>
            <SelectItem
              value="last_week"
              className="rounded-lg"
              key="last_week"
            >
              La semana pasada
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent
        className={`flex flex-col lg:flex-row gap-8 justify-center w-full transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] w-full py-4"
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
              dataKey="user.name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              className="capitalize"
            />
            <ChartTooltip
              content={<ChartTooltipContent className="w-[200px] capitalize" />}
            />
            <Bar dataKey="active" fill="var(--primary-color-700)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
