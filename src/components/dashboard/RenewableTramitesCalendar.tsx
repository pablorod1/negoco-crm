"use client";
import React from "react";
import { Calendar } from "../ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CalendarDays, RefreshCwOff } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import TramiteRenovable from "./TramiteRenovable";
import { es } from "date-fns/locale";
import { User } from "@/lib/core/types";

interface RenewableTramite {
  id: string;
  renovationDate: string;
  sales_name: string;
}

export default function RenewableTramitesCalendar({
  loading,
  userData,
}: {
  loading: boolean;
  userData: User;
}) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [renewableDates, setRenewableDates] = React.useState<
    RenewableTramite[]
  >([]);

  const fetchTramites = React.useCallback(async () => {
    try {
      const res = await fetch(`
        /api/tramites/get/renewable?userData=${JSON.stringify(userData)}
      `);
      const { data, success, error } = await res.json();

      if (!success && error) {
        throw new Error(error || "Error al obtener trámites renovables");
      }
      setRenewableDates(data);
    } catch (error) {
      console.error("Error al obtener trámites renovables:", error);
    }
  }, [userData]);

  React.useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  const modifiersStyles = {
    renewable: {
      backgroundColor: "var(--warning-color)",
      color: "white",
      borderRadius: "50%",
    },
    oneMonthBefore: {
      backgroundColor: "var(--primary-color-300)",
      color: "var(--primary-color-800)",
      borderRadius: "50%",
    },
  };

  const isOneMonthBeforeRenovationDate = (date: Date) => {
    return renewableDates.some((tramite) => {
      const renovationDate = new Date(tramite.renovationDate);
      const oneMonthBefore = new Date(renovationDate);
      oneMonthBefore.setMonth(renovationDate.getMonth() - 1);

      return date >= oneMonthBefore && date <= renovationDate;
    });
  };

  const isRenewableDay = (date: Date) => {
    return renewableDates.some(
      (tramite) =>
        new Date(tramite.renovationDate).getDate() === date.getDate() &&
        new Date(tramite.renovationDate).getMonth() === date.getMonth() &&
        new Date(tramite.renovationDate).getFullYear() === date.getFullYear()
    );
  };

  const filteredTramites = date
    ? renewableDates.filter((tramite) => {
        const renovationDate = new Date(tramite.renovationDate);
        const oneMonthBefore = new Date(renovationDate);
        oneMonthBefore.setMonth(renovationDate.getMonth() - 1);

        return date >= oneMonthBefore && date <= renovationDate;
      })
    : [];

  return (
    <Card
      className={`relative w-full h-full backdrop-blur-lg border-0 shadow-[0_2px_6px_rgba(0,0,0,0.1)] group transition-colors duration-300 ${
        loading ? "bg-gray-200 " : "bg-white"
      }`}
    >
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader
        className={`transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg backdrop-blur-md bg-white/90 shadow-md bg-opacity-10">
            <CalendarDays className="text-[var(--primary-color-800)]" />
          </div>
          <CardTitle>
            <h3 className="text-xl font-semibold text-[var(--primary-color-800)]">
              Trámites renovables
            </h3>
            {date && (
              <span className="text-sm text-gray-500 font-medium">
                {date.toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col lg:flex-row gap-8 justify-center w-full transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          modifiers={{
            renewable: isRenewableDay,
            oneMonthBefore: isOneMonthBeforeRenovationDate,
          }}
          modifiersStyles={modifiersStyles}
          className="rounded-md capitalize"
          locale={es}
        />
        <div className="w-full">
          {date ? (
            <div className="space-y-4 w-full">
              {filteredTramites.length > 0 ? (
                <ScrollArea className="h-72 w-full rounded-md">
                  <ul className="space-y-2">
                    {filteredTramites.map((tramite, index) => (
                      <TramiteRenovable key={index} tramite={tramite} />
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <div className="w-full h-44 flex justify-center items-center flex-col gap-4">
                  <RefreshCwOff className="size-16 mx-auto text-gray-300" />
                  <p className="text-gray-500 text-center">
                    No hay trámites renovables para esta fecha
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">
              Selecciona una fecha para ver los trámites
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
