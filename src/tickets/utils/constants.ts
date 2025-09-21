import { Option } from "@/core/components/ui/multiselect";

// Filter options for tickets
export const TICKET_STATUS_OPTIONS: Option[] = [
  { label: "Abierto", value: "1" },
  { label: "En Proceso", value: "2" },
  { label: "Resuelto", value: "3" },
  { label: "Cerrado", value: "4" },
];

export const TICKET_PRIORITY_OPTIONS: Option[] = [
  { label: "Baja", value: "low" },
  { label: "Media", value: "medium" },
  { label: "Alta", value: "high" },
  { label: "Urgente", value: "urgent" },
];

export const TICKET_CONTEXT_OPTIONS: Option[] = [
  { label: "Trámite", value: "tramite" },
  { label: "Cliente", value: "cliente" },
  { label: "Comparativa", value: "comparativa" },
  { label: "Fotovoltaica", value: "fotovoltaica" },
];

// Utility functions for formatting
export const formatContext = (context: string): string => {
  switch (context) {
    case "tramite":
      return "Trámite";
    case "cliente":
      return "Cliente";
    case "comparativa":
      return "Comparativa";
    case "fotovoltaica":
      return "Fotovoltaica";
    default:
      return context;
  }
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
