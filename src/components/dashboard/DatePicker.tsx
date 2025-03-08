"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { es } from "date-fns/locale";

interface Props {
  date?: Date;
  setDate?: (date: Date | undefined) => void;
  modifiersStyles?: Record<string, React.CSSProperties>;
  modifiers?: Record<string, (date: Date) => boolean>;
}

export function DatePickerDemo({
  date,
  setDate,
  modifiers,
  modifiersStyles,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={`w-[280px] justify-start text-left font-normal"
            ${!date && "text-muted-foreground"}`}
        >
          <CalendarIcon />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          locale={es}
          mode="single"
          selected={date}
          onSelect={setDate}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
