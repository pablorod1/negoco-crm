import type { UpdatedFields } from "@/tramites/hooks/track-tramite-changes";
import type { Notification } from "@/core/types";
import { formatUUID } from "./format";

export const getColorPriority = (priority: number) => {
  switch (priority) {
    case 1:
      return "danger";
    case 2:
      return "warning";
    case 3:
      return "success";
    default:
      return "pending";
  }
};

export const getLinkContext = (context: string, link: string): string => {
  switch (context) {
    case "Password":
      return "/perfil";
    case "Comparativas":
      return `/comparativas/${link}`;
    case "Tramites":
      return `/tramites/${link}`;
    case "Tickets-tramite":
      return `/tramites/${link}`;
    case "Tickets-comparativa":
      return `/comparativas/${link}`;
    case "Tickets-fotovoltaica":
      return `/fotovoltaica/${link}`;
    case "Tickets-cliente":
      return `/clientes/${link}`;
    case "Tickets":
      // Fallback para compatibilidad con notificaciones existentes
      // Intentamos detectar el tipo de objeto basado en el prefijo del link
      if (link.startsWith("NEG-")) {
        return `/tramites/${link}`;
      } else if (link.startsWith("CMP-")) {
        return `/comparativas/${link}`;
      } else if (link.startsWith("FOT-")) {
        return `/fotovoltaica/${link}`;
      } else if (link.startsWith("CLI-")) {
        return `/clientes/${link}`;
      } else {
        // Fallback genérico si no podemos detectar el tipo
        return "/";
      }
    case "Fotovoltaicas":
      return `/fotovoltaica/${link}`;
    default:
      return "/";
  }
};

export const generateTramitesNotificationMessage = (
  changes?: UpdatedFields | undefined,
  uploadedFiles?: File[] | undefined,
): string => {
  const messages: string[] = [];

  // Revisamos los cambios en el trámite
  if (changes) {
    if (changes.tramite) {
      if (changes.tramite.status) {
        messages.push("Se ha actualizado el estado del trámite");
      }
      if (changes.tramite.notes) {
        messages.push("Se han añadido notas al trámite");
      }
      if (changes.tramite?.user_id) {
        messages.push("Se te ha asignado un nuevo trámite");
      }
      if (changes.tramite.comision_sales_person) {
        messages.push("Se ha modificado tu comisión");
      }
      // Revisamos otros campos
      if (changes.signer) {
        messages.push(
          "Se ha modificado la información de la persona firmante del trámite",
        );
      }

      if (changes.client) {
        messages.push(
          "Se ha modificado la información del cliente del trámite",
        );
      }

      if (changes.contracts) {
        messages.push("Se han modificado los contratos del trámite");
      }
    }
  }

  // Revisamos los archivos subidos
  if (uploadedFiles && uploadedFiles.length > 0) {
    messages.push("Se han subido nuevos archivos al trámite");
  }

  // Si hay varios cambios, retornamos un mensaje por defecto
  if (messages.length > 1) {
    return "Se han actualizado varios campos del trámite";
  }

  // Si solo hay un cambio, retornamos el mensaje específico
  return messages.length > 0
    ? messages.join(", ")
    : "Se han realizado cambios en el trámite";
};

interface TramiteNotification {
  changes?: UpdatedFields | undefined;
  uploadedFiles?: File[] | undefined;
  tramite_id: string;
  client: string;
  user_id: string;
}

export const generateTramiteUpdatedNotification = ({
  changes,
  uploadedFiles,
  tramite_id,
  user_id,
  client,
}: TramiteNotification): Notification => ({
  id: tramite_id,
  title: `Trámite ${formatUUID(tramite_id)} actualizado`,
  message: generateTramitesNotificationMessage(changes, uploadedFiles),
  client,
  created_at: new Date().toISOString(),
  context: "Tramites",
  link: tramite_id,
  priority: 3,
  user_id: user_id,
});

export const generateComparativaNotificationMessage = (
  notes: boolean | undefined,
  status: string | undefined,
  files: boolean | undefined,
  comissions: boolean | undefined,
) => {
  const messages: string[] = [];

  if (notes) {
    messages.push("Se han añadido notas a la comparativa");
  }

  if (status) {
    messages.push(
      `Se ha actualizado el estado de la comparativa a ${
        status === "pending"
          ? "Pendiente de Estudio"
          : status === "completed"
            ? "Estudio Realizado"
            : status === "processed"
              ? "Completada"
              : "Desconocido"
      }`,
    );
  }

  if (files) {
    messages.push("Se han subido nuevos archivos a la comparativa");
  }

  if (comissions) {
    messages.push("Se han modificado las comisiones de la comparativa");
  }

  if (messages.length > 1) {
    return status
      ? "Se ha actualizado el estado de la comparativa"
      : "Se han actualizado varios campos de la comparativa";
  }

  return messages.length > 0
    ? messages.join(", ")
    : "Se han realizado cambios en la comparativa";
};

interface ComparativaNotification {
  comparativa_id: string;
  client: string;
  user_id: string;
  notes?: boolean;
  status?: string;
  files?: boolean;
  comissions?: boolean;
}

export const generateComparativaUpdatedNotification = ({
  comparativa_id,
  client,
  user_id,
  notes,
  status,
  files,
  comissions,
}: ComparativaNotification): Notification => {
  return {
    id: comparativa_id,
    title: `Comparativa ${formatUUID(comparativa_id)} actualizada`,
    message: generateComparativaNotificationMessage(
      notes,
      status,
      files,
      comissions,
    ),
    client,
    created_at: new Date().toISOString(),
    context: "Comparativas",
    link: comparativa_id,
    priority: 3,
    user_id: user_id,
  };
};

interface FotovoltaicaNotification {
  fotovoltaica_id: string;
  client: string;
  user_id: string;
  notes?: boolean;
  status?: string;
  files?: boolean;
}

export const generateFotovoltaicaNotificationMessage = (
  notes: boolean | undefined,
  status: string | undefined,
  files: boolean | undefined,
): string => {
  const messages: string[] = [];

  if (notes) {
    messages.push("Se han añadido notas a la solicitud fotovoltaica");
  }

  if (status) {
    messages.push(
      `Se ha actualizado el estado de la solicitud fotovoltaica a ${status}`,
    );
  }

  if (files) {
    messages.push("Se han subido nuevos archivos a la solicitud fotovoltaica");
  }

  if (messages.length > 1) {
    return "Se han actualizado varios campos de la solicitud fotovoltaica";
  }

  return messages.length > 0
    ? messages.join(", ")
    : "Se han realizado cambios en la solictud fotovoltaica";
};
export const generateFotovoltaicaUpdatedNotification = ({
  fotovoltaica_id,
  client,
  user_id,
  notes,
  status,
  files,
}: FotovoltaicaNotification): Notification => {
  return {
    id: fotovoltaica_id,
    title: `Solicitud fotovoltaica ${formatUUID(fotovoltaica_id)} actualizada`,
    message: generateFotovoltaicaNotificationMessage(notes, status, files),
    client,
    created_at: new Date().toISOString(),
    context: "Fotovoltaicas",
    link: fotovoltaica_id,
    priority: 3,
    user_id: user_id,
  };
};

// ==================== TICKET NOTIFICATIONS ====================

interface TicketCreatedNotification {
  subject: string;
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  ref_id: string;
  user_id: string;
  client?: string;
  created_by_name?: string;
}

interface TicketReplyNotification {
  ticket_id: string;
  subject: string;
  context: string;
  ref_id: string;
  user_id: string;
  client?: string;
  author_name?: string;
}

export const generateTicketCreatedNotificationMessage = (
  context: string,
  subject: string,
  created_by_name?: string,
): string => {
  const contextName =
    {
      tramite: "trámite",
      comparativa: "comparativa",
      fotovoltaica: "solicitud fotovoltaica",
      cliente: "cliente",
    }[context] || "elemento";

  const creatorInfo = created_by_name ? ` por ${created_by_name}` : "";

  return `Se ha creado un nuevo ticket en tu ${contextName}${creatorInfo}: "${subject}"`;
};

export const generateTicketReplyNotificationMessage = (
  subject: string,
  author_name?: string,
): string => {
  const authorInfo = author_name ? ` de ${author_name}` : "";
  return `Hay una nueva respuesta${authorInfo} en el ticket: "${subject}"`;
};

export const generateTicketCreatedNotification = ({
  subject,
  context,
  ref_id,
  user_id,
  client,
  created_by_name,
}: TicketCreatedNotification): Notification => {
  // Crear contexto específico para tickets basado en el tipo de objeto
  const ticketContext = `Tickets-${context.toLowerCase()}`;

  return {
    id: crypto.randomUUID(),
    title: "Nuevo ticket asignado",
    message: generateTicketCreatedNotificationMessage(
      context,
      subject,
      created_by_name,
    ),
    client,
    created_at: new Date().toISOString(),
    context: ticketContext,
    link: ref_id, // Link directo al objeto (tramite/comparativa/etc.)
    priority: 2,
    user_id: user_id,
  };
};

export const generateTicketReplyNotification = ({
  ticket_id,
  subject,
  context,
  ref_id,
  user_id,
  client,
  author_name,
}: TicketReplyNotification): Notification => {
  // Crear contexto específico para tickets basado en el tipo de objeto
  const ticketContext = `Tickets-${context.toLowerCase()}`;

  return {
    id: `TICKET-REPLY-${ticket_id}-${crypto.randomUUID()}`,
    title: "Nueva respuesta en ticket",
    message: generateTicketReplyNotificationMessage(subject, author_name),
    client,
    created_at: new Date().toISOString(),
    context: ticketContext,
    link: ref_id, // Link directo al objeto (tramite/comparativa/etc.)
    priority: 2,
    user_id: user_id,
  };
};
