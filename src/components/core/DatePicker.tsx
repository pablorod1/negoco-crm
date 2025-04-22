"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { es } from "date-fns/locale";
import { formatDate } from "@/lib/core/format";

interface Props {
  className?: string;
  date?: Date;
  setDate?: (date: Date | undefined) => void;
}

export function DatePicker({ className, date, setDate }: Props) {
  return (
    <div className={cn("grid w-full", className)}>
      <Popover modal>
        <PopoverTrigger asChild className="w-full">
          <Button
            id="date"
            className={cn(
              "text-black flex w-full py-1  rounded-md border min-h-10 h-auto items-center justify-start bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon />
            {date ? (
              <>{formatDate(date.toString())}</>
            ) : (
              <span>Selecciona una fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto flex justify-start items-center px-0"
          align="start"
        >
          <Calendar
            mode="single"
            defaultMonth={new Date()}
            selected={date}
            onSelect={setDate}
            numberOfMonths={1}
            locale={es}
            className="capitalize"
            required={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
