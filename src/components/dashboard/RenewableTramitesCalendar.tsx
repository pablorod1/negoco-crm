import React from "react";
import { Calendar } from "../ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CalendarDays, FileText } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

interface RenewableTramite {
  tramite_id: string;
  renovationDate: Date;
}

const renewableDates: RenewableTramite[] = [
  {
    tramite_id: "TRAM-001",
    renovationDate: new Date(2025, 0, 15),
  },
  {
    tramite_id: "TRAM-001",
    renovationDate: new Date(2025, 0, 15),
  },
  {
    tramite_id: "TRAM-001",
    renovationDate: new Date(2025, 0, 15),
  },
  {
    tramite_id: "TRAM-001",
    renovationDate: new Date(2025, 0, 15),
  },
  {
    tramite_id: "TRAM-001",
    renovationDate: new Date(2025, 0, 15),
  },
  {
    tramite_id: "TRAM-001",
    renovationDate: new Date(2025, 0, 15),
  },
  {
    tramite_id: "TRAM-002",
    renovationDate: new Date(2025, 0, 22),
  },
  {
    tramite_id: "TRAM-003",
    renovationDate: new Date(2025, 0, 28),
  },
];

export default function RenewableTramitesCalendar() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

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
        tramite.renovationDate.getDate() === date.getDate() &&
        tramite.renovationDate.getMonth() === date.getMonth() &&
        tramite.renovationDate.getFullYear() === date.getFullYear()
    );
  };

  const filteredTramites = date
    ? renewableDates.filter(
        (tramite) =>
          tramite.renovationDate.getDate() === date.getDate() &&
          tramite.renovationDate.getMonth() === date.getMonth() &&
          tramite.renovationDate.getFullYear() === date.getFullYear()
      )
    : [];

  return (
    <div className="flex gap-4 h-full w-full">
      <Card className="h-full w-full">
        <CardHeader>
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
        <CardContent className="flex flex-col lg:flex-row gap-8 justify-center w-full">
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
    </div>
  );
}
