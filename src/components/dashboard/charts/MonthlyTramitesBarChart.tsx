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
import { getActiveTramitesByUserID } from "@/lib/libsql/data/tramites/getTramites";
import { DateRange } from "react-day-picker";
import { Button } from "@heroui/react";
import { CalendarOff } from "lucide-react";

const chartConfig = {
  tramites: {
    label: "Tramites",
  },
  active: {
    label: "Trámites",
    color: "var(--primary-color-500)",
  },
} satisfies ChartConfig;

interface TramitesData {
  month: string;
  active: number;
}

export function PersonalTramitesChart({ loading }: { loading: boolean }) {
  const [timeRange, setTimeRange] = React.useState<
    "year" | "current_month" | "current_week" | "last_week" | "90d" | undefined
  >("year");
  const [dateRange, setDateRange] = React.useState<DateRange>();
  const [chartData, setChartData] = React.useState<TramitesData[]>([]);

  const fetchData = React.useCallback(async () => {
    try {
      const res = await getActiveTramitesByUserID(timeRange, dateRange);
      const transformedData = res.map((item) => ({
        month: item.field,
        active: item.value,
      }));
      setChartData(transformedData);
    } catch (error) {
      console.error("Error fetching personal tramites data:", error);
    }
  }, [timeRange, dateRange]);

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
      className={`relative h-full backdrop-blur-lg bg-white/80 border border-white/20 shadow-[0_2px_6px_rgba(0,0,0,0.14)] transition-all duration-500 ${
        loading ? "bg-gray-200 border-0" : "bg-white/80 border border-white/10"
      } `}
    >
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-500 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader
        className={`flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row  ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle className="text-xl text-[var(--primary-color-800)]">
            Resumen de tus ventas
          </CardTitle>
          <CardDescription>Mostrando las ventas de 2025</CardDescription>
        </div>
        {dateRange && (
          <Button
            onPress={resetDateRange}
            isIconOnly
            className="bg-transparent"
          >
            <CalendarOff width={20} height={20} stroke="var(--danger-color)" />
          </Button>
        )}
        <DateRangePicker
          className="rounded-lg"
          date={dateRange}
          setDateRange={handleDateRangeChange}
        />
        <Select value={timeRange} onValueChange={handleTimeRangeChange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto "
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
      </CardHeader>
      <CardContent className={` ${loading ? "opacity-0" : "opacity-100"}`}>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full py-4"
        >
          <AreaChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />

            <ChartTooltip
              content={
                <ChartTooltipContent className="capitalize" indicator="dot" />
              }
              cursor={false}
              defaultIndex={1}
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
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={24}
              minTickGap={12}
              className="!px-12"
            />
            <Area
              dataKey="active"
              type="monotone"
              fill="url(#fillActive)"
              fillOpacity={0.4}
              stroke="var(--primary-color-800)"
            />
            <ChartLegend content={<ChartLegendContent className="mt-6" />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
