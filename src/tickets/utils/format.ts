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
