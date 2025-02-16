"use client";
import React from "react";
import { Calendar } from "../ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CalendarDays, FileText } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { getRenewableTramites } from "@/lib/libsql/data/tramites/getTramites";

interface RenewableTramite {
  tramite_id: string;
  renovationDate: string;
}

export default function RenewableTramitesCalendar({
  loading,
}: {
  loading: boolean;
}) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [renewableDates, setRenewableDates] = React.useState<
    RenewableTramite[]
  >([]);

  const fetchTramites = React.useCallback(async () => {
    try {
      const data = await getRenewableTramites();
      setRenewableDates(data);
    } catch (error) {
      console.error("Error al obtener trámites renovables:", error);
    }
  }, []);

  React.useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  const modifiersStyles = {
    renewable: {
      backgroundColor: "var(--primary-color-500)",
      color: "white",
      borderRadius: "50%",
    },
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
    ? renewableDates.filter(
        (tramite) =>
          new Date(tramite.renovationDate).getDate() === date.getDate() &&
          new Date(tramite.renovationDate).getMonth() === date.getMonth() &&
          new Date(tramite.renovationDate).getFullYear() === date.getFullYear()
      )
    : [];

  return (
    <Card
      className={`relative w-full h-full backdrop-blur-lg border border-white/10 bg-white/80  shadow-[0_2px_6px_rgba(0,0,0,0.14)] group ${
        loading ? "bg-gray-200 border-0" : "bg-white/80 border border-white/20"
      }`}
    >
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-500 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader className={`${loading ? "opacity-0" : "opacity-100"}`}>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[var(--primary-color-800)]" />
          <CardTitle>
            <h3 className="text-xl font-semibold text-[var(--primary-color-800)]">
              Trámites renovables
              {date &&
                ` para ${date.toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
            </h3>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col lg:flex-row gap-8 justify-center w-full ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          modifiers={{ renewable: isRenewableDay }}
          modifiersStyles={modifiersStyles}
          className="rounded-md"
        />
        <div className="w-full ">
          {date ? (
            <div className="space-y-4">
              {filteredTramites.length > 0 ? (
                <ScrollArea className="h-72 w-full rounded-md ">
                  <ul className="space-y-2">
                    {filteredTramites.map((tramite, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-3 p-3  rounded-lg border border-[var(--primary-color-200)] hover:bg-[var(--primary-color-200)] transition-colors duration-200 ease-in-out"
                      >
                        <FileText className="h-5 w-5 text-[var(--primary-color-500)]" />
                        <span className="font-medium text-[var(--primary-color-700)]">
                          {tramite.tramite_id}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <p className="text-gray-500 italic">
                  No hay trámites para renovar en esta fecha
                </p>
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
