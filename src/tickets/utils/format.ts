export const formatTicketType = (type: string | undefined): string => {
  switch (type) {
    case "note":
      return "Nota Rápida";
    case "incidencia":
      return "Incidencia";
    default:
      return "Nota Rápida";
  }
};

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

export const formatDateTimeShort = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffInHours < 24 * 7) {
    return date.toLocaleDateString("es-ES", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
  }
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};
