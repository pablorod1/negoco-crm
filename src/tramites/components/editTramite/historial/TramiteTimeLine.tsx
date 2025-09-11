"use client";

import React from "react";
import { TramiteDB } from "@/tramites/types";
import {
  Clock,
  Activity,
  CreditCard,
  CheckCircle,
  XCircle,
  Calendar,
  AlertCircle,
  InfoIcon,
  RefreshCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { cn } from "@/core/utils";
import TooltipComponent from "@/core/components/TooltipComponent";
import UpdateTramiteDateModal from "../dates/UpdateTramiteDateModal";

interface Props {
  tramite: TramiteDB;
  isComercial: boolean;
  onUpdate?: () => void;
}

interface TimelineEvent {
  id: string;
  label: string;
  date: string | null;
  description?: string;
  tooltipContent?: string;
  fieldToChange?: string;
  status: "completed" | "pending" | "cancelled" | "current";
  icon: React.ReactNode;
  category: "process" | "financial" | "administrative";
}

export default function TramiteTimeLine({
  tramite,
  isComercial,
  onUpdate,
}: Props) {
  // Generate timeline events based on tramite data
  const generateTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        id: "created",
        label: "Trámite Creado",
        date: tramite.creation_date,
        description: "El trámite fue creado en el sistema",
        status: tramite.creation_date ? "completed" : "pending",
        icon: <Activity className="h-4 w-4" />,
        category: "process",
      },
      {
        id: "tramitation",
        label: "Fecha de Tramitación",
        date: tramite.tramitation_date,
        description: "El trámite fue verificado y procesado",
        tooltipContent:
          "La fecha de tramitación se asignará cuando el estado del trámite cambie a Verificado.",
        fieldToChange: "tramitation_date",
        status: tramite.tramitation_date
          ? "completed"
          : tramite.status === "Baja"
            ? "cancelled"
            : "pending",
        icon: <CheckCircle className="h-4 w-4" />,
        category: "process",
      },
      {
        id: "activation",
        label: "Fecha de Activación",
        date: tramite.activation_date,
        description: "El contrato fue activado",
        tooltipContent:
          "La fecha de activación se asignará cuando el estado del trámite cambie a Activo.",
        fieldToChange: "activation_date",
        status: tramite.activation_date
          ? "completed"
          : tramite.status === "Baja"
            ? "cancelled"
            : tramite.status === "Activo"
              ? "current"
              : "pending",
        icon: <CheckCircle className="h-4 w-4" />,
        category: "process",
      },
    ];

    // Add renewal if exists
    if (tramite.renovation_date) {
      events.push({
        id: "renovation",
        label: "Fecha de Renovación",
        date: tramite.renovation_date,
        description: "Fecha de renovación del contrato",
        tooltipContent:
          "La fecha de renovación se asignará cuando el estado del trámite cambie a Activo.",
        fieldToChange: "renovation_date",
        status:
          new Date(tramite.renovation_date) <= new Date()
            ? "current"
            : "pending",
        icon: <Calendar className="h-4 w-4" />,
        category: "administrative",
      });
    }

    // Add rejection if exists
    if (tramite.rejected_date) {
      events.push({
        id: "rejected",
        label: "Fecha de Baja",
        date: tramite.rejected_date,
        description: "El trámite fue dado de baja",
        tooltipContent:
          "La fecha de baja se asignará cuando el estado del trámite cambie a Baja.",
        fieldToChange: "rejected_date",
        status: "cancelled",
        icon: <XCircle className="h-4 w-4" />,
        category: "administrative",
      });
    }

    // Add financial events if not comercial
    if (!isComercial) {
      events.push(
        {
          id: "collection",
          label: "Fecha de Cobro",
          date: tramite.collection_date,
          description: "Cobrado por la comercializadora",
          tooltipContent:
            "La fecha de activación se asignará cuando el estado de liquidez del trámite cambie a Cobrado por Comercializadora.",
          fieldToChange: "collection_date",
          status: tramite.collection_date ? "completed" : "pending",
          icon: <CreditCard className="h-4 w-4" />,
          category: "financial",
        },
        {
          id: "payment",
          label: "Fecha de Pago",
          date: tramite.payment_date,
          description: "Pagado al comercial",
          tooltipContent:
            "La fecha de renovación se asignará cuando el estado de liquidez del trámite cambie a Pagado al Comercial.",
          fieldToChange: "payment_date",
          status: tramite.payment_date ? "completed" : "pending",
          icon: <CreditCard className="h-4 w-4" />,
          category: "financial",
        }
      );
    }

    // Sort by date (nulls last)
    return events.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  };

  const timelineEvents = generateTimelineEvents();

  const getStatusStyles = (status: TimelineEvent["status"]) => {
    switch (status) {
      case "completed":
        return {
          dot: "bg-green-500 border-green-200",
          line: "bg-green-200",
          text: "text-green-700",
          bg: "bg-green-50",
        };
      case "current":
        return {
          dot: "bg-blue-500 border-blue-200 animate-pulse",
          line: "bg-blue-200",
          text: "text-blue-700",
          bg: "bg-blue-50",
        };
      case "cancelled":
        return {
          dot: "bg-red-500 border-red-200",
          line: "bg-red-200",
          text: "text-red-700",
          bg: "bg-red-50",
        };
      default:
        return {
          dot: "bg-gray-300 border-gray-200",
          line: "bg-gray-200",
          text: "text-gray-500",
          bg: "bg-gray-50",
        };
    }
  };

  const getCategoryColor = (category: TimelineEvent["category"]) => {
    switch (category) {
      case "process":
        return "text-blue-600";
      case "financial":
        return "text-green-600";
      case "administrative":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Pendiente";
    try {
      return new Date(dateString).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-gray-800 text-lg font-semibold">
          <Clock className="h-5 w-5 text-gray-600" />
          Timeline del Trámite
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          {timelineEvents.map((event, index) => {
            const isLast = index === timelineEvents.length - 1;
            const styles = getStatusStyles(event.status);

            return (
              <div key={event.id} className="relative flex items-start group">
                {/* Timeline line */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-4 top-10 w-0.5 h-16 z-0 transition-colors duration-300",
                      styles.line
                    )}
                  />
                )}

                {/* Timeline dot */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 group-hover:scale-110",
                    styles.dot
                  )}
                >
                  <div
                    className={cn(
                      "transition-colors duration-300",
                      styles.text
                    )}
                  >
                    {event.icon}
                  </div>
                </div>

                {/* Event content */}
                <div className="ml-6 pb-8 flex-1">
                  <div
                    className={cn(
                      "p-4 rounded-lg border border-gray-200 transition-all duration-300 hover:shadow-md",
                      styles.bg
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {event.label}
                          </h3>

                          {/* Tooltip for automatic updates */}
                          {event.tooltipContent && (
                            <TooltipComponent
                              color="bg-white shadow-md"
                              content={
                                <div className="flex items-start gap-2 p-2.5 max-w-xs">
                                  <RefreshCcw className="size-4 text-primary-500 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <h3 className="font-medium text-gray-800 text-sm">
                                      Actualización Automática
                                    </h3>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      {event.tooltipContent}
                                    </p>
                                  </div>
                                </div>
                              }
                            >
                              <InfoIcon className="size-3 text-gray-400 hover:text-primary-400 transition-colors cursor-help" />
                            </TooltipComponent>
                          )}

                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-1 rounded-full",
                              getCategoryColor(event.category),
                              event.category === "process" && "bg-blue-100",
                              event.category === "financial" && "bg-green-100",
                              event.category === "administrative" &&
                                "bg-purple-100"
                            )}
                          >
                            {event.category === "process" && "Proceso"}
                            {event.category === "financial" && "Financiero"}
                            {event.category === "administrative" &&
                              "Administrativo"}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              event.date ? "text-gray-700" : "text-gray-400"
                            )}
                          >
                            {formatDate(event.date)}
                          </span>
                        </div>
                      </div>

                      {/* Status indicator and edit button */}
                      <div className="flex items-center gap-2">
                        {/* Edit button for dates */}
                        {event.date && event.fieldToChange && !isComercial && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <UpdateTramiteDateModal
                              dateToChange={event.label}
                              date={new Date(event.date)}
                              tramite_id={tramite.id}
                              fieldToChange={event.fieldToChange}
                              onUpdate={onUpdate}
                            />
                          </div>
                        )}

                        {/* Status indicators */}
                        <div className="flex items-center gap-1">
                          {event.status === "completed" && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          {event.status === "current" && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                              <AlertCircle className="h-5 w-5 text-blue-500" />
                            </div>
                          )}
                          {event.status === "cancelled" && (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          {event.status === "pending" && (
                            <Clock className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
