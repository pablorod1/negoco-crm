import React from "react";
import { NumberTicker } from "../ui/number-ticker";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { InfoIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import TooltipComponent from "../core/TooltipComponent";

interface Props {
  title: string;
  value: number;
  difference?: number;
  description?: string;
  loading?: boolean;
}

const DashboardCard = ({
  title,
  value,
  difference,
  loading,
  description,
}: Props) => {
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
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-0 justify-between flex-row items-start">
            <CardDescription>{title}</CardDescription>
            {difference !== undefined && (
              <Badge
                variant={
                  difference > 0
                    ? "success"
                    : difference < 0
                      ? "danger"
                      : "default"
                }
                className="rounded-lg text-xs text-white"
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
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <NumberTicker
              className=" text-4xl font-semibold tabular-nums text-primary-700"
              value={value as number}
            >
              {value}
            </NumberTicker>
          </CardContent>
          <CardFooter className="justify-between items-center gap-1 mt-auto">
            <span className="text-muted-foreground text-xs">{description}</span>
            {difference !== undefined && (
              <TooltipComponent content="Variación respecto al mes anterior">
                <InfoIcon size={12} className="text-gray-600" />
              </TooltipComponent>
            )}
          </CardFooter>
        </Card>
      )}
    </>
  );
};

export default DashboardCard;
