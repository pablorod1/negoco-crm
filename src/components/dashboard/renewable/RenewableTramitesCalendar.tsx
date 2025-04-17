"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { User } from "@/lib/core/types";
import { DatePickerDemo } from "../DatePicker";
import { Button } from "@/components/ui/button";
import { RenewableTramitesAnimatedList } from "./RenewableTramitesAnimatedList";
import Image from "next/image";

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
  const [mostRecentRenewableDate, setMostRecentRenewableDate] = React.useState<
    Date | undefined
  >();

  const fetchTramites = React.useCallback(async () => {
    try {
      const res = await fetch(
        `
        /api/tramites/get/renewable
      `,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: userData.id,
            role: userData.role,
          }),
        }
      );
      const { data, success, error } = await res.json();
      if (!success && error) {
        throw new Error(error || "Error al obtener trámites renovables");
      }
      setRenewableDates(data);
      if (data.length > 0) {
        const mostRecentDate = new Date(data[0].renovationDate);
        setMostRecentRenewableDate(mostRecentDate);
      }
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
      const twoMonthBefore = new Date(renovationDate);
      twoMonthBefore.setMonth(renovationDate.getMonth() - 2);

      return date >= twoMonthBefore && date <= renovationDate;
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
        const twoMonthBefore = new Date(renovationDate);
        twoMonthBefore.setMonth(renovationDate.getMonth() - 2);

        return date >= twoMonthBefore && date <= renovationDate;
      })
    : [];

  const handleMostRecentRenewableDate = () => {
    setDate(mostRecentRenewableDate);
  };

  return (
    <Card
      className={`flex flex-col justify-between relative h-full backdrop-blur-lg  transition-colors duration-300 overflow-hidden ${
        loading ? "bg-gray-200 " : "bg-white"
      }`}
    >
      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-50 rounded-full opacity-30 blur-2xl"></div>
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary-100 rounded-full opacity-40 blur-xl"></div>
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader
        className={`flex flex-row justify-between w-full transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-start gap-4">
          <CardTitle className="flex flex-col">
            <h3 className="text-base 2xl:text-xl font-semibold text-primary-800">
              Trámites renovables
            </h3>

            <span className="text-xs text-primary-400 font-medium">
              Listado de trámites renovables
            </span>
          </CardTitle>
        </div>
        <DatePickerDemo
          date={date}
          setDate={setDate}
          modifiers={{
            renewable: isRenewableDay,
            oneMonthBefore: isOneMonthBeforeRenovationDate,
          }}
          modifiersStyles={modifiersStyles}
        />
      </CardHeader>
      <CardContent
        className={`flex flex-col lg:flex-row gap-8 justify-center h-full w-full transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="w-full h-full">
          {date ? (
            <div className="space-y-4 w-full h-full">
              {filteredTramites.length > 0 ? (
                <RenewableTramitesAnimatedList items={filteredTramites} />
              ) : (
                <div className="w-full h-full flex justify-center items-center flex-col space-y-4 p-6 text-center transition-all duration-300">
                  <div className="relative">
                    <Image
                      src="/icons/renovacion.webp"
                      alt="No hay comparativas"
                      width={80}
                      height={80}
                      className="opacity-70 animate-pulse transform transition-transform hover:scale-105"
                    />
                  </div>

                  <div className=" text-center">
                    {mostRecentRenewableDate ? (
                      <h2 className="text-base font-bold text-gray-600">
                        No hay trámites renovables para esta fecha
                      </h2>
                    ) : (
                      <p className="text-base font-bold text-gray-600">
                        No hay trámites renovables en este momento
                      </p>
                    )}

                    {mostRecentRenewableDate && (
                      <Button
                        variant="outline"
                        onClick={handleMostRecentRenewableDate}
                        className="animate-fadeIn"
                      >
                        Ver el próximo trámite renovable
                      </Button>
                    )}

                    {!mostRecentRenewableDate && (
                      <p className="text-gray-500 italic text-sm">
                        Todos los trámites están al día
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic text-sm">
              Selecciona una fecha para ver los trámites
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
