import { UpdatedFields } from "@/hooks/track-tramite-changes";
import { BadgeProps } from "@heroui/react";
import { Notification } from "./types";

export const getColorPriority = (priority: number): BadgeProps["color"] => {
  switch (priority) {
    case 1:
      return "danger";
    case 2:
      return "warning";
    case 3:
      return "success";
    default:
      return "primary";
  }
};

export const getLinkContext = (context: string, link: string): string => {
  switch (context) {
    case "Password":
      return "/perfil";
    case "Comparativas":
      return `/comparativas?id=${link}`;
    case "Tramites":
      return `/tramites?id=${link}`;
    default:
      return "/";
  }
};

export const generateTramitesNotificationMessage = (
  changes: UpdatedFields,
  uploadedFiles: File[]
): string => {
  const messages: string[] = [];

  // Revisamos los cambios en el trámite
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
  }

  // Revisamos los archivos subidos
  if (uploadedFiles.length > 0) {
    messages.push("Se han subido nuevos archivos al trámite");
  }

  // Revisamos otros campos
  if (changes.signer) {
    messages.push(
      "Se ha modificado la información de la persona firmante del trámite"
    );
  }

  if (changes.client) {
    messages.push("Se ha modificado la información del cliente del trámite");
  }

  if (changes.contracts) {
    messages.push("Se han modificado los contratos del trámite");
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

export const generateTramiteUpdatedNotification = (
  changes: UpdatedFields,
  uploadedFiles: File[],
  tramite_id: string,
  user_id: string
): Notification => ({
  id: tramite_id,
  title: `Trámite ${tramite_id} actualizado`,
  message: generateTramitesNotificationMessage(changes, uploadedFiles),
  created_at: new Date().toISOString(),
  context: "Tramites",
  link: tramite_id,
  priority: 3,
  user_id: user_id,
});
