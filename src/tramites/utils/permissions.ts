import { EditTramiteFormData } from "@/tramites/types/tramite.types";

/**
 * Determina si un trámite se puede editar según el estado y rol del usuario
 * Lógica extraída exactamente del componente TramiteDetails
 */
export function isEditableTramite(
  tramite: EditTramiteFormData,
  userRole?: string,
): boolean {
  if (!userRole) return false;

  // Lógica exacta del componente original:
  // userData.role === "admin" || userData.role === "1" || (userData.role === "2" && tramite.status === "Borrador")
  // && tramite.status !== "Baja"
  const status = tramite.tramite.status;

  return (
    (userRole === "admin" ||
      userRole === "1" ||
      (userRole === "2" && status === "Borrador")) &&
    status !== "Baja"
  );
}

/**
 * Determina si un trámite se puede editar comercialmente según el estado y rol del usuario
 * Lógica extraída exactamente del componente TramiteDetails
 */
export function isComercialEditableTramite(
  tramite: EditTramiteFormData,
  userRole?: string,
): boolean {
  if (!userRole) return false;

  // Lógica exacta del componente original:
  // userData.role === "admin" || userData.role === "1" || (userData.role === "2" && tramite.status === "Borrador")
  const status = tramite.tramite.status;

  return (
    userRole === "admin" ||
    userRole === "1" ||
    (userRole === "2" && status === "Borrador")
  );
}

/**
 * Determina si un trámite se puede renovar
 * Lógica extraída exactamente del componente TramiteDetails
 */
export function isRenewableTramite(tramite: EditTramiteFormData): boolean {
  // Lógica exacta del componente original:
  // new Date(tramite.renovation_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) esto significa
  return (
    new Date(tramite.tramite.renovation_date) <=
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
  );
}

/**
 * Determina si un trámite está activo
 * Lógica extraída exactamente del componente TramiteDetails
 */
export function isActiveTramite(tramite: EditTramiteFormData): boolean {
  return tramite.tramite.status === "Activo";
}

/**
 * Verifica si el usuario tiene permisos de administrador
 * Lógica extraída exactamente del componente TramiteDetails
 */
export function isAdminUser(userRole?: string): boolean {
  if (!userRole) return false;
  return userRole === "admin";
}

/**
 * Verifica si el usuario es comercial
 * Lógica extraída exactamente del componente TramiteDetails
 */
export function isComercialUser(userRole?: string): boolean {
  if (!userRole) return false;
  return userRole === "2";
}

/**
 * Verifica si el usuario es backoffice
 * Lógica extraída exactamente del componente TramiteDetails
 */
function isBackofficeUser(userRole?: string): boolean {
  if (!userRole) return false;
  return userRole === "1";
}

/**
 * Verifica si hay notas en el trámite
 * Lógica extraída exactamente del componente TramiteDetails
 */
export function hasNotes(tramite: EditTramiteFormData): boolean {
  return (
    (tramite.tramite.notes && tramite.tramite.notes.length > 0) ||
    (tramite.tramite.internal_notes &&
      tramite.tramite.internal_notes.length > 0)
  );
}
