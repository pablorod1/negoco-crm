"use client";
import { Chip } from "@heroui/chip";
import { ComparativaStatus, LiquidezStatus, Status } from "../core/types";

const COMPARATIVA_STATUS_BADGES = {
  pending: (
    <Chip variant="faded" color="warning">
      Pendiente de Estudio
    </Chip>
  ),
  completed: (
    <Chip variant="faded" color="success">
      Estudio Realizado
    </Chip>
  ),
  processed: (
    <Chip
      variant="faded"
      color="primary"
      className="bg-[var(--primary-color-100)]"
    >
      Comparativa Tramitada
    </Chip>
  ),
  rejected: (
    <Chip variant="faded" color="danger">
      Rechazada
    </Chip>
  ),
  default: <Chip variant="faded">Desconocido</Chip>,
};

const LIQUIDEZ_STATUS_BADGES = {
  "Pendiente de Cobro": (
    <Chip variant="faded" color="warning">
      Pendiente de Cobro
    </Chip>
  ),
  "Cobrado por Comercializadora": (
    <Chip variant="faded" color="success">
      Cobrado por Comercializadora
    </Chip>
  ),
  "Pagado al Comercial": (
    <Chip
      variant="faded"
      color="primary"
      className="bg-[var(--primary-color-100)]"
    >
      Pagado al Comercial
    </Chip>
  ),
  default: <Chip variant="faded">Sin Asignar</Chip>,
};

const STATUS_BADGES = {
  Borrador: (
    <Chip variant="faded" color="danger" className="bg-danger-100">
      Borrador
    </Chip>
  ),
  Tramitable: (
    <Chip variant="faded" color="default" className="bg-default-100">
      Tramitable
    </Chip>
  ),
  Verificado: (
    <Chip variant="faded" color="secondary" className="bg-secondary-100">
      Verificado
    </Chip>
  ),
  "Pendiente de Firma": (
    <Chip variant="faded" color="warning" className="bg-warning-100">
      Pendiente de Firma
    </Chip>
  ),
  Procesando: (
    <Chip variant="faded" color="primary" className="bg-primary-100">
      Procesando
    </Chip>
  ),
  Activo: (
    <Chip variant="faded" color="success" className="bg-success-100">
      Activo
    </Chip>
  ),
  Baja: (
    <Chip variant="faded" color="danger" className="bg-danger-100">
      Baja
    </Chip>
  ),
  default: <Chip variant="faded">Sin Asignar</Chip>,
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
