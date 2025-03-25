"use client";
import { Chip } from "@heroui/chip";
import { ComparativaStatus, LiquidezStatus, Status } from "../core/types";

const COMPARATIVA_STATUS_BADGES = {
  pending: (
    <Chip
      variant="bordered"
      size="sm"
      color="warning"
      className="bg-warning-50"
    >
      Pendiente de Estudio
    </Chip>
  ),
  completed: (
    <Chip
      variant="bordered"
      size="sm"
      color="success"
      className="bg-success-50"
    >
      Estudio Realizado
    </Chip>
  ),
  processed: (
    <Chip
      variant="bordered"
      size="sm"
      color="primary"
      className="bg-primary-50"
    >
      Comparativa Tramitada
    </Chip>
  ),
  rejected: (
    <Chip variant="bordered" size="sm" color="danger" className="bg-danger-50">
      Rechazada
    </Chip>
  ),
  default: (
    <Chip variant="bordered" size="sm">
      Desconocido
    </Chip>
  ),
};

const LIQUIDEZ_STATUS_BADGES = {
  "Pendiente de Cobro": (
    <Chip
      variant="bordered"
      size="sm"
      color="warning"
      className="bg-warning-50"
    >
      Pendiente de Cobro
    </Chip>
  ),
  "Cobrado por Comercializadora": (
    <Chip
      variant="bordered"
      size="sm"
      color="success"
      className="bg-success-50"
    >
      Cobrado por Comercializadora
    </Chip>
  ),
  "Pagado al Comercial": (
    <Chip
      variant="bordered"
      size="sm"
      color="primary"
      className="bg-primary-50"
    >
      Pagado al Comercial
    </Chip>
  ),
  default: (
    <Chip variant="bordered" size="sm">
      Sin Asignar
    </Chip>
  ),
};

const STATUS_BADGES = {
  Borrador: (
    <Chip variant="bordered" size="sm" color="danger" className="bg-danger-50">
      Borrador
    </Chip>
  ),
  Tramitable: (
    <Chip variant="bordered" size="sm" color="default">
      Tramitable
    </Chip>
  ),
  Verificado: (
    <Chip
      variant="bordered"
      size="sm"
      color="secondary"
      className="bg-secondary-50"
    >
      Verificado
    </Chip>
  ),
  "Pendiente de Firma": (
    <Chip
      variant="bordered"
      size="sm"
      color="warning"
      className="bg-warning-50"
    >
      Pendiente de Firma
    </Chip>
  ),
  Procesando: (
    <Chip
      variant="bordered"
      size="sm"
      color="primary"
      className="bg-primary-50"
    >
      Procesando
    </Chip>
  ),
  Activo: (
    <Chip
      variant="bordered"
      size="sm"
      color="success"
      className="bg-success-50"
    >
      Activo
    </Chip>
  ),
  Baja: (
    <Chip variant="bordered" size="sm" color="danger" className="bg-danger-50">
      Baja
    </Chip>
  ),
  default: (
    <Chip variant="bordered" size="sm">
      Sin Asignar
    </Chip>
  ),
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
