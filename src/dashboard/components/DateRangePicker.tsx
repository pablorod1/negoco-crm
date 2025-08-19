"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/core/utils";
import { Button } from "@/core/components/ui/button";
import { Calendar } from "@/core/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { es } from "date-fns/locale";

interface Props {
  className?: string;
  date?: DateRange;
  setDateRange?: (dateRange: DateRange | undefined) => void;
}

export function DateRangePicker({ className, date, setDateRange }: Props) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            className={cn(
              "text-black flex w-full py-1 ps-4 rounded-md border min-h-10 h-auto items-center justify-start bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Selecciona una fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto flex justify-center items-center px-0"
          align="start"
        >
          <Calendar
            mode="range"
            defaultMonth={new Date()}
            selected={date}
            onSelect={setDateRange}
            numberOfMonths={2}
            locale={es}
            className="capitalize"
            required={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

