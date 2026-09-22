import type { AbarcaSyncStatus } from "@/core/hooks/use-abarca-sync-statuses";

/** Etiquetas y colores para el estado de sincronización con el Comparador. */
export const STATUS_META: Record<
  AbarcaSyncStatus,
  { label: string; className: string }
> = {
  attention: {
    label: "Error al sincronizar",
    className: "bg-red-100 text-red-700",
  },
  pending: {
    label: "Pendiente de enviar",
    className: "bg-amber-100 text-amber-700",
  },
  syncing: {
    label: "Sincronizando",
    className: "bg-blue-100 text-blue-700",
  },
  synced: {
    label: "Sincronizado",
    className: "bg-green-100 text-green-700",
  },
  not_applicable: {
    label: "Sin usuario del Comparador",
    className: "bg-gray-100 text-gray-500",
  },
};

/** `last_warnings` llega como JSON-array serializado; el parseo es tolerante. */
export function parseWarnings(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const makeReadable = (entry: unknown) => {
    const warning = String(entry)
      .replaceAll("luz_20td", "Luz 2.0TD")
      .replaceAll("luz_pymes", "Luz pymes")
      .replaceAll("gas", "Gas");
    if (warning.endsWith(": sin mapeo")) {
      return "Una comercializadora no tiene equivalencia interna con el Comparador. Contacta con soporte.";
    }
    if (warning.includes(": no disponible o bloqueada")) {
      return warning.replace(
        ": no disponible o bloqueada",
        ": no disponible en el Comparador. Contacta con soporte.",
      );
    }
    return warning;
  };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(makeReadable).filter(Boolean);
    }
    return [makeReadable(parsed)];
  } catch {
    return [makeReadable(raw)];
  }
}
