"use client";
import { Badge } from "@/components/ui/badge";
import { ComparativaStatus, LiquidezStatus, Status } from "../core/types";

const COMPARATIVA_STATUS_BADGES = {
  pending: <Badge variant="warning">Pendiente de Estudio</Badge>,
  completed: <Badge variant="pending">Estudio Realizado</Badge>,
  processed: <Badge variant="success">Completada</Badge>,
  rejected: <Badge variant="danger">Rechazada</Badge>,
  default: <Badge>Desconocido</Badge>,
};

const LIQUIDEZ_STATUS_BADGES = {
  "Pendiente de Cobro": <Badge variant="warning">Pendiente de Cobro</Badge>,
  "Cobrado por Comercializadora": (
    <Badge variant="pending">Cobrado por Comercializadora</Badge>
  ),
  "Pagado al Comercial": <Badge variant="success">Pagado al Comercial</Badge>,
  "Pendiente de Descontar": (
    <Badge variant="warning">Pendiente de Descontar</Badge>
  ),
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
  default: <Badge>Sin Asignar</Badge>,
};

export const getStatusBadge = (
  status: ComparativaStatus | LiquidezStatus | Status
) => {
  // Verificar si el status pertenece a ComparativaStatus
  if (
    ["pending", "completed", "processed", "rejected"].includes(
      status as ComparativaStatus
    )
  ) {
    return (
      COMPARATIVA_STATUS_BADGES[status as ComparativaStatus] ||
      COMPARATIVA_STATUS_BADGES.default
    );
  }

  // Verificar si el status pertenece a LiquidezStatus
  if (
    [
      "Pendiente de Cobro",
      "Cobrado por Comercializadora",
      "Pagado al Comercial",
      "Pendiente de Descontar",
      "Descontado",
    ].includes(status as string)
  ) {
    return (
      LIQUIDEZ_STATUS_BADGES[status as keyof typeof LIQUIDEZ_STATUS_BADGES] ||
      LIQUIDEZ_STATUS_BADGES.default
    );
  }

  // Por defecto, asumir que es un Status general
  return STATUS_BADGES[status as Status] || STATUS_BADGES.default;
};
