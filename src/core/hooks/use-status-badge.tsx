"use client";
import { Badge } from "@/core/components/ui/badge";
import {
  ComparativaStatus,
  FotovoltaicaStatus,
  LiquidezStatus,
  Status,
} from "@/core/types";

const COMPARATIVA_STATUS_BADGES = {
  pending: <Badge variant="warning">Pendiente de Estudio</Badge>,
  processing: (
    <Badge className="border-indigo-300 bg-indigo-50 text-indigo-700">
      Procesando
    </Badge>
  ),
  awaiting_review: <Badge variant="info">Pendiente de Revisión</Badge>,
  completed: <Badge variant="pending">Estudio Realizado</Badge>,
  processed: <Badge variant="success">Completada</Badge>,
  rejected: <Badge variant="danger">Rechazada</Badge>,
  rechazado_cliente: <Badge variant="danger">Rechazado Cliente</Badge>,
  default: <Badge>Desconocido</Badge>,
};

const LIQUIDEZ_STATUS_BADGES = {
  "Pendiente de Cobro": <Badge variant="warning">Pendiente de Cobro</Badge>,
  "Cobrado por Comercializadora": (
    <Badge variant="pending">Cobrado por Comercializadora</Badge>
  ),
  Adelantado: <Badge variant="info">Adelantado</Badge>,
  "Pagado al Comercial": <Badge variant="success">Pagado al Comercial</Badge>,
  "Pendiente de Descontar": (
    <Badge variant="warning">Pendiente de Descontar</Badge>
  ),
  Descontado: <Badge variant="success">Descontado</Badge>,
  default: <Badge>Sin Asignar</Badge>,
};

const TABLE_LIQUIDEZ_STATUS_BADGES = {
  "Pendiente de Cobro": <Badge variant="warning">Pendiente</Badge>,
  "Cobrado por Comercializadora": <Badge variant="pending">Cobrado</Badge>,
  Adelantado: <Badge variant="info">Adelantado</Badge>,
  "Pagado al Comercial": <Badge variant="success">Pagado</Badge>,
  "Pendiente de Descontar": <Badge variant="warning">Pendiente</Badge>,
  Descontado: <Badge variant="success">Descontado</Badge>,
  default: <Badge>Sin Asignar</Badge>,
};

const STATUS_BADGES = {
  Borrador: <Badge variant="danger">Borrador</Badge>,
  Tramitable: <Badge variant="warning">Tramitable</Badge>,
  Verificado: <Badge variant="secondary">Verificado</Badge>,
  "Pendiente de Firma": <Badge variant="info">Pendiente de Firma</Badge>,
  Procesando: <Badge variant="pending">Procesando</Badge>,
  Activo: <Badge variant="success">Activo</Badge>,
  Baja: <Badge variant="danger">Baja</Badge>,
  Scoring: <Badge variant="danger">Scoring</Badge>,
  Incidencia: <Badge variant="warning">Incidencia</Badge>,
  KO: <Badge variant="danger">KO</Badge>,
  default: <Badge>Sin Asignar</Badge>,
};

const FOTOVOLTAICA_STATUS_BADGES = {
  pending: <Badge variant="warning">Pendiente</Badge>,
  validated: <Badge variant="secondary">Validado</Badge>,
  processing: <Badge variant="pending">Procesando</Badge>,
  completed: <Badge variant="success">Completado</Badge>,
  rejected: <Badge variant="danger">Rechazado</Badge>,
  default: <Badge>Sin Asignar</Badge>,
};

const TICKET_STATUS_BADGES = {
  1: <Badge variant="pending">Abierto</Badge>,
  2: <Badge variant="warning">En Proceso</Badge>,
  3: <Badge variant="success">Resuelto</Badge>,
  4: <Badge variant="danger">Cerrado</Badge>,
};

const TICKET_PRIORITY_BADGES = {
  low: <Badge variant="success">Baja</Badge>,
  medium: <Badge variant="pending">Media</Badge>,
  high: <Badge variant="warning">Alta</Badge>,
  urgent: <Badge variant="danger">Urgente</Badge>,
  default: <Badge>Sin Asignar</Badge>,
};

export const getStatusBadge = (
  status:
    | ComparativaStatus
    | LiquidezStatus
    | Status
    | FotovoltaicaStatus
    | number
    | string,
  statusType?:
    | "comparativa"
    | "liquidez"
    | "fotovoltaica"
    | "general"
    | "ticket",
  isTable: boolean = false,
) => {
  // If statusType is explicitly provided, use it directly
  if (statusType === "fotovoltaica") {
    return (
      FOTOVOLTAICA_STATUS_BADGES[status as FotovoltaicaStatus] ||
      FOTOVOLTAICA_STATUS_BADGES.default
    );
  }

  if (statusType === "comparativa") {
    return (
      COMPARATIVA_STATUS_BADGES[status as ComparativaStatus] ||
      COMPARATIVA_STATUS_BADGES.default
    );
  }

  if (statusType === "liquidez") {
    if (isTable) {
      return (
        TABLE_LIQUIDEZ_STATUS_BADGES[
          status as keyof typeof TABLE_LIQUIDEZ_STATUS_BADGES
        ] || TABLE_LIQUIDEZ_STATUS_BADGES.default
      );
    } else {
      return (
        LIQUIDEZ_STATUS_BADGES[status as keyof typeof LIQUIDEZ_STATUS_BADGES] ||
        LIQUIDEZ_STATUS_BADGES.default
      );
    }
  }

  if (statusType === "general") {
    return STATUS_BADGES[status as Status] || STATUS_BADGES.default;
  }

  // Fallback to old logic for backward compatibility
  // Verificar si el status pertenece a FotovoltaicaStatus
  if (
    ["pending", "validated", "processing", "completed", "rejected"].includes(
      status as FotovoltaicaStatus,
    )
  ) {
    return (
      FOTOVOLTAICA_STATUS_BADGES[status as FotovoltaicaStatus] ||
      FOTOVOLTAICA_STATUS_BADGES.default
    );
  }

  // Verificar si el status pertenece a ComparativaStatus
  if (
    [
      "pending",
      "processing",
      "awaiting_review",
      "completed",
      "processed",
      "rejected",
      "rechazado_cliente",
    ].includes(
      status as ComparativaStatus,
    )
  ) {
    return (
      COMPARATIVA_STATUS_BADGES[status as ComparativaStatus] ||
      COMPARATIVA_STATUS_BADGES.default
    );
  }

  // Verificar si el status pertenece a Ticket Status
  if ([1, 2, 3, 4].includes(status as number)) {
    return (
      TICKET_STATUS_BADGES[status as keyof typeof TICKET_STATUS_BADGES] || (
        <Badge>Desconocido</Badge>
      )
    );
  }

  // Verificar si el status pertenece a Ticket Priority
  if (["low", "medium", "high", "urgent"].includes(status as string)) {
    return (
      TICKET_PRIORITY_BADGES[status as keyof typeof TICKET_PRIORITY_BADGES] ||
      TICKET_PRIORITY_BADGES.default
    );
  }

  // Verificar si el status pertenece a LiquidezStatus
  if (
    [
      "Pendiente de Cobro",
      "Cobrado por Comercializadora",
      "Pagado al Comercial",
      "Adelantado",
      "Pendiente de Descontar",
      "Descontado",
    ].includes(status as string)
  ) {
    if (isTable) {
      return (
        TABLE_LIQUIDEZ_STATUS_BADGES[
          status as keyof typeof TABLE_LIQUIDEZ_STATUS_BADGES
        ] || TABLE_LIQUIDEZ_STATUS_BADGES.default
      );
    } else {
      return (
        LIQUIDEZ_STATUS_BADGES[status as keyof typeof LIQUIDEZ_STATUS_BADGES] ||
        LIQUIDEZ_STATUS_BADGES.default
      );
    }
  }

  // Por defecto, asumir que es un Status general
  return STATUS_BADGES[status as Status] || STATUS_BADGES.default;
};
