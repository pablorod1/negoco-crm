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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { Label } from "@/components/ui/label";

const chartConfig = {
  tramites: {
    label: "Tramites",
  },
  active: {
    label: "Activos",
    color: "var(--primary-color-700)",
  },
  baja: {
    label: "Bajas",
    color: "var(--danger-color)",
  },
} satisfies ChartConfig;

interface Data {
  user: Partial<User>;
  active: number;
  baja: number;
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
        const res = await fetch(`/api/tramites/get/team-tramites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: userData.id,
            role: userData.role,
            time_range: timeRange,
          }),
        });
        const { data, success, error } = await res.json();

        if (!success && error) {
          throw new Error(error || "Error fetching tramites");
        }
        setChartData(data as Data[]);
        setComerciales([...data.map((item: Data) => item.user as User)]);
      } else {
        const res = await fetch(
          `/api/tramites/get/active-tramites-by-user-id`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              role: userData.role,
              id: selectedComercial,
              time_range: timeRange,
            }),
          }
        );
        const { data, success, error } = await res.json();
        if (!success && error) {
          throw new Error(error || "Error fetching tramites");
        }

        setChartData(data);
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
      className={`flex flex-col ${
        comerciales.length > 0 ? "justify-between" : ""
      }  relative w-full h-full backdrop-blur-lg border-0 group transition-colors duration-300 overflow-hidden ${
        loading ? "bg-gray-200" : "bg-white"
      }`}
    >
      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-50 rounded-full opacity-30 blur-2xl"></div>
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary-100 rounded-full opacity-40 blur-xl"></div>
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader
        className={`flex items-start justify-between gap-2  border-b py-5 sm:flex-row transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle className="text-xl text-primary-800">
            Resumen de ventas de tu equipo
          </CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </div>
        <div className="flex flex-row-reverse items-center  justify-end gap-2">
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500">Rango de tiempo</Label>
            <Select
              value={timeRange}
              onValueChange={handleTimeRangeChange}
              disabled={
                loading ||
                !comerciales ||
                comerciales.length === 0 ||
                selectedComercial === "all"
              }
            >
              <SelectTrigger
                className="w-[160px] rounded-md shadow "
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
          </div>
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500">Comercial</Label>
            <Select
              disabled={loading || !comerciales || comerciales.length === 0}
              value={selectedComercial}
              onValueChange={setSelectedComercial}
            >
              <SelectTrigger
                className="w-[260px] rounded-md shadow "
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
                      <Avatar className="h-7 w-7 rounded-full">
                        <AvatarImage
                          src={comercial.image as string}
                          alt={comercial.name}
                        />
                        <AvatarFallback className="rounded-lg bg-primary-100 text-primary-800">
                          {comercial.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{comercial.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={` w-full transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        {comerciales && comerciales.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="h-full max-h-[300px] w-full py-4"
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
                dataKey={selectedComercial === "all" ? "user.name" : "field"}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                className="capitalize"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    className="w-[200px] capitalize"
                  />
                }
              />
              <Bar
                dataKey="active"
                fill="var(--primary-color-700)"
                radius={4}
              />
              <Bar dataKey="baja" fill="var(--danger-color)" radius={4} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex flex-col gap-2 items-center justify-center h-80 w-full">
            <Users className="h-12 w-12 text-gray-500" />

            <div className="flex flex-col items-center ">
              <p className="text-lg text-gray-500">
                Todavía no tienes comerciales en tu equipo
              </p>
              <p className="text-sm text-gray-400">
                Aquí se mostrarán las ventas de tu equipo
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
