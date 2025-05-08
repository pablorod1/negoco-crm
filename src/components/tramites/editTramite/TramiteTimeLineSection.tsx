import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TramiteDB } from "@/lib/core/types";
import {
  Clock,
  Activity,
  CreditCard,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import TimelineItem from "./TimelineItem";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

interface Props {
  tramite: TramiteDB;
  isComercial: boolean;
  onUpdate?: () => void;
}

export default function TramiteTimeLineSection({
  tramite,
  isComercial,
  onUpdate,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Define categories and their items
  const timelineCategories = [
    {
      id: "process",
      label: "Proceso",
      icon: <Activity className="size-4 text-primary-600" />,
      items: [
        {
          label: "Fecha de Creación",
          date: tramite.creation_date,
          tramite_id: tramite.id,
        },
        {
          label: "Fecha de Tramitación",
          date: tramite.tramitation_date,
          tooltipContent:
            "La fecha de tramitación se asignará cuando el estado del trámite cambie a Verificado.",
          tramite_id: tramite.id,
          fieldToChange: "tramitation_date",
          onUpdate,
          isAdmin: !isComercial,
        },
        {
          label: "Fecha de Activación",
          date: tramite.activation_date,
          tooltipContent:
            "La fecha de activación se asignará cuando el estado del trámite cambie a Activo.",
          tramite_id: tramite.id,
          fieldToChange: "activation_date",
          onUpdate,
          isAdmin: !isComercial,
        },
      ],
    },
  ];

  // Only add these sections for non-comercial users
  if (!isComercial) {
    // Add additional category
    const additionalItems = [
      {
        label: "Fecha de Renovación",
        date: tramite.renovation_date,
        tooltipContent:
          "La fecha de renovación se asignará cuando el estado del trámite cambie a Activo.",
        tramite_id: tramite.id,
        fieldToChange: "renovation_date",
        onUpdate,
        isAdmin: !isComercial,
      },
    ];

    if (tramite.rejected_date) {
      additionalItems.push({
        label: "Fecha de Baja",
        date: tramite.rejected_date,
        tooltipContent:
          "La fecha de baja se asignará cuando el estado del trámite cambie a Baja.",
        tramite_id: tramite.id,
        fieldToChange: "rejected_date",
        onUpdate,
        isAdmin: !isComercial,
      });
    }

    timelineCategories.push({
      id: "additional",
      label: "Información Adicional",
      icon: <Clock className="size-4 text-primary-600" />,
      items: additionalItems,
    });

    // Add financial category
    timelineCategories.push({
      id: "financial",
      label: "Información Financiera",
      icon: <CreditCard className="size-4 text-primary-600" />,
      items: [
        {
          label: "Fecha de Cobro",
          date: tramite.collection_date || "---",
          tooltipContent:
            "La fecha de activación se asignará cuando el estado de liquidez del trámite cambie a Cobrado por Comercializadora.",
          tramite_id: tramite.id,
          fieldToChange: "collection_date",
          onUpdate,
          isAdmin: !isComercial,
        },
        {
          label: "Fecha de Pago",
          date: tramite.payment_date || "---",
          tooltipContent:
            "La fecha de renovación se asignará cuando el estado de liquidez del trámite cambie a Pagado al Comercial.",
          tramite_id: tramite.id,
          fieldToChange: "payment_date",
          onUpdate,
          isAdmin: !isComercial,
        },
      ],
    });
  }

  return (
    <Card
      className={cn(
        "mb-6 shadow-sm border-gray-200 overflow-hidden animate-size transition-all duration-500 ease-in-out",
        isExpanded ? "h-auto" : "h-20"
      )}
    >
      <CardHeader>
        <Button
          className="flex justify-between items-center w-full"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="flex items-center gap-2 text-primary-800 text-lg">
            <Clock className="h-5 w-5" />
            Línea de Tiempo
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {timelineCategories.map((category) => (
            <div
              key={category.id}
              className="border border-gray-200 rounded-md overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                <div className="flex items-center gap-2">
                  {category.icon}
                  <h3 className="text-sm font-medium text-gray-800">
                    {category.label}
                  </h3>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {category.items.map((item, index) => (
                  <TimelineItem key={`${category.id}-${index}`} {...item} />
                ))}
                {category.items.length === 0 && (
                  <div className="px-4 py-3 text-center text-sm text-gray-500">
                    No hay información disponible
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
