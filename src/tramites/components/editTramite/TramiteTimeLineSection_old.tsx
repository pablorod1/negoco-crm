import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { TramiteDB } from "@/tramites/types";
import {
  Clock,
  Activity,
  CreditCard,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import TimelineItem from "./TimelineItem";
import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";

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
      icon: <Activity className="h-4 w-4 text-gray-600" />,
      items: [
        {
          label: "Fecha de Creación",
          date: tramite.creation_date || "---",
          tramite_id: tramite.id,
        },
        {
          label: "Fecha de Tramitación",
          date: tramite.tramitation_date || "---",
          tooltipContent:
            "La fecha de tramitación se asignará cuando el estado del trámite cambie a Verificado.",
          tramite_id: tramite.id,
          fieldToChange: "tramitation_date",
          onUpdate,
          isAdmin: !isComercial,
        },
        {
          label: "Fecha de Activación",
          date: tramite.activation_date || "---",
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
        date: tramite.renovation_date || "---",
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
        date: tramite.rejected_date || "---",
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
      icon: <Clock className="h-4 w-4 text-gray-600" />,
      items: additionalItems,
    });

    // Add financial category
    timelineCategories.push({
      id: "financial",
      label: "Información Financiera",
      icon: <CreditCard className="h-4 w-4 text-gray-600" />,
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
        "overflow-hidden transition-all duration-300 ease-in-out border-gray-200 shadow-sm",
        isExpanded ? "h-auto" : "h-16"
      )}
    >
      <CardHeader className="p-4">
        <Button
          className="flex justify-between items-center w-full p-0 h-auto hover:bg-transparent"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="flex items-center gap-3 text-gray-800 text-lg font-semibold">
            <Clock className="h-5 w-5 text-gray-600" />
            Línea de Tiempo
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {timelineCategories.map((category) => (
              <div
                key={category.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
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
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      No hay información disponible
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
