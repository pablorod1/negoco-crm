import React, { useMemo } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Coins,
  InfoIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { User } from "@/lib/core/types";
import { formatComission } from "@/lib/core/format";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis } from "recharts";

interface Props {
  loading: boolean;
  userData: User;
}

interface ChartData {
  month: string;
  total: number;
}

const chartConfig = {
  balance: {
    label: "Balance",
    color: "var(--primary-color-500)",
  },
} satisfies ChartConfig;

export default function BalanceChart({ loading, userData }: Props) {
  const [chartData, setChartData] = React.useState<ChartData[]>([]);

  const fetchComisiones = React.useCallback(async () => {
    if (!loading) {
      try {
        const res = await fetch(
          `
            /api/tramites/get/monthly-comisiones
            `,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: userData.id, role: userData.role }),
          }
        );
        const { success, data, error } = await res.json();

        if (!success && error) {
          throw new Error(error);
        }
        setChartData(data);
      } catch (error) {
        console.error("Error al obtener comisiones:", error);
      } finally {
      }
    }
  }, [userData, loading]);

  React.useEffect(() => {
    fetchComisiones();
  }, [fetchComisiones]);

  const totalBalance = chartData.reduce((acc, { total }) => acc + total, 0);

  const calculateDifference = (data: ChartData[]) => {
    const date = new Date();
    const currentMonth = date.getMonth();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;

    const currentTotal = data[currentMonth]?.total || 0;
    const prevTotal = data[prevMonth]?.total || 0;

    const difference =
      prevTotal !== 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    return difference;
  };

  const difference = calculateDifference(chartData);

  // Filter chart data to show only the last 6 months
  const reducedChartData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();

    // Create array with the last 6 months
    const last6Months = Array.from({ length: 6 }, (_, index) => {
      const monthIndex = (currentMonth - index + 12) % 12;
      const monthNames = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];
      return {
        month: monthNames[monthIndex],
        total: chartData[monthIndex]?.total || 0,
      };
    }).reverse();

    return last6Months;
  }, [chartData]);

  return (
    <>
      {loading ? (
        <div className="animate-pulse bg-card">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="w-1/2 h-5 bg-muted-foreground rounded" />
            <div className="w-3/4 h-8 bg-muted-foreground rounded" />
          </div>
          <div className="p-6 pt-0">
            <div className="w-3/4 h-8 bg-muted-foreground rounded" />
          </div>
        </div>
      ) : (
        <Card className=" flex flex-col">
          <CardHeader className="relative flex flex-row justify-between items-start gap-2 w-full">
            <div className="flex flex-col items-start">
              <CardDescription>Balance Total</CardDescription>
              <CardTitle className="@[250px]/card:text-3xl text-3xl font-semibold tabular-nums text-primary-700">
                <NumberTicker
                  endContent="€"
                  value={totalBalance}
                  decimalPlaces={2}
                  className="text-3xl font-bold text-[var(--primary-color-800)]"
                >
                  {formatComission(totalBalance)}
                </NumberTicker>
              </CardTitle>
            </div>
            {difference !== undefined && (
              <Chip
                variant="shadow"
                className="rounded-lg text-xs text-white"
                color={
                  difference > 0
                    ? "success"
                    : difference < 0
                    ? "danger"
                    : "primary"
                }
              >
                <div className="flex items-center gap-2">
                  <span>
                    {difference > 0 ? (
                      <TrendingUpIcon className="size-4" />
                    ) : difference < 0 ? (
                      <TrendingDownIcon className="size-4" />
                    ) : (
                      "---"
                    )}
                  </span>
                  {difference !== 0 && <span>{difference}%</span>}
                </div>
              </Chip>
            )}
          </CardHeader>
          <CardContent className="flex-1">
            <ChartContainer
              config={chartConfig}
              className="max-h-[60px] w-full"
            >
              <LineChart accessibilityLayer data={reducedChartData}>
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  hide={true}
                  axisLine={false}
                  tickFormatter={(value) => {
                    return value.slice(0, 3);
                  }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      className="w-44 h-16"
                      labelFormatter={(label) => {
                        const currentYear = new Date().getFullYear();
                        return `📆 ${label} ${currentYear}`;
                      }}
                      formatter={(value) => (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1 font-semibold text-primary-900">
                            <Coins size={14} />
                            <span>Comisión</span>
                          </div>
                          <span className="font-bold">
                            {formatComission(value as number)}
                          </span>
                        </div>
                      )}
                    />
                  }
                  cursor={false}
                  defaultIndex={1}
                />
                <Line
                  dataKey="total"
                  type="monotone"
                  stroke="var(--primary-color-500)"
                  strokeWidth={2}
                  dot={{
                    fill: "var(--primary-color-500)",
                  }}
                  activeDot={{
                    r: 6,
                  }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="justify-between items-center gap-1 mt-auto">
            <span className="text-muted-foreground text-xs">
              Balance total de tus comisiones 2025
            </span>
            {difference !== undefined && (
              <Tooltip content="Variación respecto al mes anterior">
                <InfoIcon size={12} className="text-gray-600" />
              </Tooltip>
            )}
          </CardFooter>
        </Card>
      )}
    </>
  );
}
