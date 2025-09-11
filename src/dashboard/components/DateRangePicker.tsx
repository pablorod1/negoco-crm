"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/core/utils";
import { Button } from "@/core/components/ui/button";
import { Calendar } from "@/core/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { es } from "date-fns/locale";

interface Props {
  className?: string;
  date?: DateRange;
  setDateRange?: (dateRange: DateRange | undefined) => void;
}

export function DateRangePicker({ className, date, setDateRange }: Props) {
  const [open, setOpen] = React.useState(false);
  const [hasInitialSelection, setHasInitialSelection] = React.useState(false);

  const handleSelect = (dateRange: DateRange | undefined) => {
    setDateRange?.(dateRange);

    // If we don't have a dateRange, reset and keep open
    if (!dateRange?.from) {
      setHasInitialSelection(false);
      return;
    }

    // If we only have 'from' (first click), mark as initial selection and keep open
    if (dateRange.from && !dateRange.to) {
      setHasInitialSelection(true);
      return;
    }

    // If we have both from and to
    if (dateRange.from && dateRange.to) {
      // Case 1: Different dates (range selection) - close immediately
      if (dateRange.from.getTime() !== dateRange.to.getTime()) {
        setOpen(false);
        setHasInitialSelection(false);
        return;
      }

      // Case 2: Same date
      if (dateRange.from.getTime() === dateRange.to.getTime()) {
        // If this is the second click on the same date, close
        if (hasInitialSelection) {
          setOpen(false);
          setHasInitialSelection(false);
        } else {
          // First click on a date, keep open for potential second click
          setHasInitialSelection(true);
        }
      }
    }
  };

  // Reset initial selection state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setHasInitialSelection(false);
    }
  }, [open]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
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
        </DialogTrigger>
        <DialogContent className="w-auto p-0">
          <DialogHeader className="sr-only" aria-describedby={undefined}>
            <DialogTitle>Seleccionar rango de fechas</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-3">
            <Calendar
              mode="range"
              defaultMonth={new Date()}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
              locale={es}
              className="capitalize"
              required={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
