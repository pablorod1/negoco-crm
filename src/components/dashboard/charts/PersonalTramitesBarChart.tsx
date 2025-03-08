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
import { DateRange } from "react-day-picker";
import { Button } from "@heroui/button";
import { CalendarOff } from "lucide-react";
import { TimeRange, User } from "@/lib/core/types";

const chartConfig = {
  tramites: {
    label: "Tramites",
  },
  active: {
    label: "Activos",
    color: "var(--primary-color-500)",
  },
  baja: {
    label: "Bajas",
    color: "var(--danger-color)",
  },
} satisfies ChartConfig;

interface TramitesData {
  field: string;
  active: number;
  baja: number;
}

export function PersonalTramitesChart({
  loading,
  userData,
}: {
  loading: boolean;
  userData: User;
}) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("year");
  const [dateRange, setDateRange] = React.useState<DateRange>();
  const [chartData, setChartData] = React.useState<TramitesData[]>([]);

  const fetchData = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tramites/get/active-tramites-by-user-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: userData.role,
          id: userData.id,
          time_range: timeRange,
          date_range: dateRange,
        }),
      });

      const { data, success, error } = await res.json();
      if (!success) {
        console.error("Error fetching personal tramites data:", error);
        return;
      }
      setChartData(data);
    } catch (error) {
      console.error("Error fetching personal tramites data:", error);
    }
  }, [timeRange, dateRange, userData]);

  const handleTimeRangeChange = (value: string) => {
    setDateRange(undefined);
    setTimeRange(
      value as "year" | "current_month" | "current_week" | "last_week" | "90d"
    );
  };

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setTimeRange(undefined);
    setDateRange(dateRange);
  };

  const resetDateRange = () => {
    setDateRange(undefined);
    setTimeRange("year");
  };

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card
      className={`flex flex-col justify-between relative h-full  backdrop-blur-lg border-0 shadow-[0_2px_6px_rgba(0,0,0,0.1)] transition-all duration-300 ${
        loading ? "bg-gray-200 " : "bg-white"
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
        className={`flex  items-start justify-between border-b py-5 sm:flex-row transition-opacity duration-300  ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <CardTitle className="text-xl text-[var(--primary-color-800)]">
            Resumen de tus ventas
          </CardTitle>
          <CardDescription>Mostrando las ventas de 2025</CardDescription>
        </div>
        <div className="flex flex-row-reverse items-center 2xl:flex-col 2xl:items-end justify-end gap-2">
          <Select
            disabled={dateRange !== undefined}
            value={timeRange}
            onValueChange={handleTimeRangeChange}
          >
            <SelectTrigger
              className="w-[160px] rounded-lg  "
              aria-label="Select a value"
            >
              <SelectValue placeholder="Este mes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl ">
              <SelectItem value="year" className="rounded-lg">
                Este año
              </SelectItem>
              <SelectItem value="90d" className="rounded-lg">
                Últimos 90 días
              </SelectItem>
              <SelectItem value="current_month" className="rounded-lg">
                Este mes
              </SelectItem>
              <SelectItem value="current_week" className="rounded-lg">
                Esta semana
              </SelectItem>
              <SelectItem value="last_week" className="rounded-lg">
                La semana pasada
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            {dateRange && (
              <Button
                onPress={resetDateRange}
                isIconOnly
                className="bg-transparent"
              >
                <CalendarOff
                  width={20}
                  height={20}
                  stroke="var(--danger-color)"
                />
              </Button>
            )}
            <DateRangePicker
              className="rounded-lg"
              date={dateRange}
              setDateRange={handleDateRangeChange}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={`transition-opacity duration-300 w-full ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <ChartContainer
          config={chartConfig}
          className=" max-h-[300px] h-full w-full py-4"
        >
          <AreaChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />

            <ChartTooltip
              content={
                <ChartTooltipContent className="capitalize" indicator="line" />
              }
            />

            <defs>
              <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--primary-color-800)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--primary-color-700)"
                  stopOpacity={0.1}
                />
              </linearGradient>

              <linearGradient id="fillBaja" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--danger-color)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--bg-danger)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="field"
              tickLine={false}
              axisLine={false}
              tickMargin={24}
              minTickGap={3}
              tickFormatter={(value) => value.slice(0, 3)}
              className=" capitalize overflow-visible"
            />
            <Area
              dataKey="active"
              type="monotone"
              fill="url(#fillActive)"
              fillOpacity={0.4}
              stroke="var(--primary-color-800)"
            />
            <Area
              dataKey="baja"
              type="monotone"
              fill="url(#fillBaja)"
              fillOpacity={0.4}
              stroke="var(--danger-color)"
            />
            <ChartLegend content={<ChartLegendContent className="mt-6" />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
