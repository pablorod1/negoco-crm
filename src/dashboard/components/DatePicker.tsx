"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/core/components/ui/button";
import { Calendar } from "@/core/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { es } from "date-fns/locale";
import { formatDate } from "@/core/utils/format";

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
          className={`text-black flex w-[160px] rounded-md border min-h-10 h-auto items-center justify-start bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto"
            ${!date && "text-muted-foreground"}`}
        >
          <CalendarIcon />
          {formatDate(date?.toString() as string) ||
            new Date().toLocaleDateString()}
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
