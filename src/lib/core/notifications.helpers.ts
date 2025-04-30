import { UpdatedFields } from "@/lib/hooks/track-tramite-changes";
import { Notification } from "./types";

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
    default:
      return "/";
  }
};

export const generateTramitesNotificationMessage = (
  changes?: UpdatedFields | undefined,
  uploadedFiles?: File[] | undefined
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
          "Se ha modificado la información de la persona firmante del trámite"
        );
      }

      if (changes.client) {
        messages.push(
          "Se ha modificado la información del cliente del trámite"
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
  title: `Trámite ${tramite_id} actualizado`,
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
  comissions: boolean | undefined
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
      }`
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
    title: `Comparativa ${comparativa_id} actualizada`,
    message: generateComparativaNotificationMessage(
      notes,
      status,
      files,
      comissions
    ),
    client,
    created_at: new Date().toISOString(),
    context: "Comparativas",
    link: comparativa_id,
    priority: 3,
    user_id: user_id,
  };
};
