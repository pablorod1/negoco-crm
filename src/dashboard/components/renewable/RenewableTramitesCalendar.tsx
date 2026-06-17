"use client";
import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { User } from "@/core/types";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import {
  differenceInDays,
  format,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/core/utils";
import { Button } from "@/core/components/ui/button";
import { useSidebarSlideNavigation } from "@/core/view-transitions/useGenieEffect";
import RenewableExportModal from "./RenewableExportModal";

interface RenewableTramite {
  id: string;
  renovationDate: string;
  sales_name: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  markers: MarkerType[];
  tramites: RenewableTramite[];
}

interface MarkerType {
  type: "renovation" | "today-reminder";
  color: string;
  isMain: boolean;
}

export default function RenewableTramitesCalendar({
  loading,
  userData,
}: {
  loading: boolean;
  userData: User;
}) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [renewableDates, setRenewableDates] = React.useState<
    RenewableTramite[]
  >([]);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleSidebarClick = useSidebarSlideNavigation();

  const fetchTramites = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/v2/contracts/renewable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userData.id,
          role: userData.role,
        }),
      });
      const { data, success, error } = await res.json();
      if (!success && error) {
        throw new Error(error || "Error al obtener trámites renovables");
      }
      setRenewableDates(data);
    } catch (error) {
      console.error("Error al obtener trámites renovables:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [userData]);

  React.useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  // Generate calendar days for current month
  const generateCalendarDays = (): CalendarDay[] => {
    const start = startOfMonth(currentDate);

    // Get first day of week (Monday = 1, Sunday = 0)
    const startDate = new Date(start);
    const dayOfWeek = startDate.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Make Monday first day
    startDate.setDate(startDate.getDate() - daysToSubtract); // Generate 42 days (6 weeks)
    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      days.push({
        date,
        isCurrentMonth: isSameMonth(date, currentDate),
        markers: getMarkersForDate(date),
        tramites: getTramitesForDate(date),
      });
    }

    return days;
  };

  // Get markers for a specific date
  const getMarkersForDate = (date: Date): MarkerType[] => {
    const markers: MarkerType[] = [];
    const today = new Date();
    const isToday = isSameDay(date, today);

    renewableDates.forEach((tramite) => {
      const renovationDate = new Date(tramite.renovationDate);
      const isRenovationDay = isSameDay(date, renovationDate);

      // 1. Marcar día de renovación
      if (isRenovationDay) {
        markers.push({ type: "renovation", color: "#dc2626", isMain: true }); // red-600
      }
    });

    // 2. Marcar día actual solo si hay trámites con renovación ≤ 60 días
    if (isToday) {
      const hasNearRenovations = renewableDates.some((tramite) => {
        const renovationDate = new Date(tramite.renovationDate);
        const daysUntilRenovation = differenceInDays(renovationDate, today);
        return daysUntilRenovation >= 0 && daysUntilRenovation <= 60;
      });

      if (hasNearRenovations) {
        // Solo añadir si no es ya día de renovación
        if (markers.length === 0) {
          markers.push({
            type: "today-reminder",
            color: "var(--blue-800)",
            isMain: true,
          }); // blue-600 para día actual
        }
      }
    }

    return markers;
  };

  // Get tramites for specific date (within 60 days)
  const getTramitesForDate = (date: Date): RenewableTramite[] => {
    return renewableDates.filter((tramite) => {
      const renovationDate = new Date(tramite.renovationDate);
      const daysUntilRenovation = differenceInDays(renovationDate, date);
      return daysUntilRenovation >= 0 && daysUntilRenovation <= 60;
    });
  };

  // Calculate month statistics
  const getMonthStats = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const thisMonthRenovations = renewableDates.filter((tramite) => {
      const renovationDate = new Date(tramite.renovationDate);
      return renovationDate >= monthStart && renovationDate <= monthEnd;
    });

    const urgentRenovations = renewableDates.filter((tramite) => {
      const renovationDate = new Date(tramite.renovationDate);
      const daysUntil = differenceInDays(renovationDate, new Date());
      return daysUntil >= 0 && daysUntil <= 7;
    });

    return {
      total: thisMonthRenovations.length,
      urgent: urgentRenovations.length,
    };
  };

  const calendarDays = generateCalendarDays();
  const monthStats = getMonthStats();

  // Handle date click
  const handleDateClick = (day: CalendarDay) => {
    if (day.tramites.length > 0) {
      setSelectedDate(day.date);
      setPopoverOpen(true);
    }
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  return (
    <Card variant={"dashboard"} className={cn(loading ? "opacity-60" : "")}>
      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-lg z-10">
          <div className="w-full h-full bg-gray-50 animate-pulse rounded-lg"></div>
        </div>
      )}

      {/* Header */}
      <CardHeader
        className={`pb-4 space-y-4 ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-gray-900 tracking-tight">
              Renovaciones
            </CardTitle>
            <p className="text-xs text-gray-500 font-medium">
              {monthStats.total === 0
                ? "Sin renovaciones este mes"
                : monthStats.total === 1
                  ? "1 renovación este mes"
                  : `${monthStats.total} renovaciones este mes`}
              {monthStats.urgent > 0 && (
                <span className="text-red-600">
                  {" "}
                  • {monthStats.urgent} urgente
                  {monthStats.urgent > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600"></div>
              <span className="text-gray-600 font-medium">Día renovación</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              onClick={fetchTramites}
              disabled={loading || isRefreshing}
              aria-label="Actualizar datos"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
            </Button>
            <RenewableExportModal
              currentDate={currentDate}
              userData={userData}
            />
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between">
          <button type="button"
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <h2 className="text-sm font-semibold text-gray-900 capitalize">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h2>

          <button type="button"
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </CardHeader>

      {/* Calendar Grid */}
      <CardContent
        className={`${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
      >
        <div className="space-y-4">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <Popover
                key={index}
                open={
                  popoverOpen &&
                  selectedDate !== null &&
                  isSameDay(selectedDate, day.date)
                }
                onOpenChange={setPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <button type="button"
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "relative p-2 h-12 text-sm font-medium rounded-lg transition-all duration-200",
                      !day.isCurrentMonth ? "text-gray-300" : "text-gray-900",
                      day.tramites.length > 0
                        ? "cursor-pointer hover:bg-blue-100"
                        : "cursor-default",
                      isSameDay(day.date, new Date())
                        ? "bg-blue-200 text-blue-900 font-semibold"
                        : "",
                      isSameDay(day.date, new Date()) && day.tramites.length > 0
                        ? "animate-pulse"
                        : "",
                    )}
                  >
                    {/* Date Number */}
                    <span className="relative z-10">
                      {format(day.date, "d")}
                    </span>

                    {/* Markers */}
                    {day.markers.map((marker, markerIndex) => (
                      <div
                        key={markerIndex}
                        className={cn(
                          "absolute inset-0 rounded-lg transition-all duration-200",
                          isSameDay(day.date, new Date())
                            ? "border-0"
                            : "border-2",
                        )}
                        style={{
                          borderColor: marker.color,
                          backgroundColor: `${marker.color}${isSameDay(day.date, new Date()) ? "80" : "15"}`,
                        }}
                      />
                    ))}

                    {/* Special renovation day indicator */}
                    {day.tramites.some((t) =>
                      isSameDay(new Date(t.renovationDate), day.date),
                    ) && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white" />
                    )}
                  </button>
                </PopoverTrigger>

                {/* Popover Content */}
                {day.tramites.length > 0 && (
                  <PopoverContent className="w-80 p-0" align="center">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center space-x-2 pb-2 border-b border-gray-100">
                        <CalendarIcon className="w-3 h-3 text-gray-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                          {format(day.date, "d MMMM yyyy", { locale: es })}
                        </h3>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {day.tramites.map((tramite) => {
                          const renewalDate = new Date(tramite.renovationDate);
                          const daysUntil = differenceInDays(
                            renewalDate,
                            day.date,
                          );

                          return (
                            <a
                              onClick={handleSidebarClick}
                              key={tramite.id}
                              href={`/tramites/${tramite.id}`}
                              className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate group-hover:text-primary-900">
                                    {tramite.sales_name}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Renovación:{" "}
                                    {format(renewalDate, "d MMM yyyy", {
                                      locale: es,
                                    })}
                                  </p>
                                  <p
                                    className={`text-xs font-medium ${
                                      daysUntil === 0
                                        ? "text-red-600"
                                        : daysUntil <= 7
                                          ? "text-red-600"
                                          : daysUntil <= 15
                                            ? "text-orange-600"
                                            : daysUntil <= 30
                                              ? "text-yellow-600"
                                              : "text-blue-600"
                                    }`}
                                  >
                                    {daysUntil === 0
                                      ? "Renovación hoy"
                                      : daysUntil === 1
                                        ? "Renovación mañana"
                                        : `Renovación en ${daysUntil} días`}
                                  </p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary-600 flex-shrink-0 ml-2" />
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {/* {renewableDates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <CalendarIcon className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Todo al día
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                No hay renovaciones programadas en los próximos 60 días. Todos
                los trámites están actualizados.
              </p>
            </div>
          </div>
        )} */}
      </CardContent>
    </Card>
  );
}
