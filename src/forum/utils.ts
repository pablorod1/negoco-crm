import { formatDate } from "@/core/utils/format";

/**
 * Monograma neutro (1-2 letras) para el avatar de un autor anónimo o real.
 * "Usuario 3" -> "U3", "Persona Real" -> "PR".
 */
export const getForumMonogram = (label: string): string => {
  const cleaned = label.trim();
  if (!cleaned) {
    return "?";
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

/**
 * Tiempo relativo compacto en español para la lista de temas
 * ("ahora", "hace 5 min", "hace 3 h", "ayer", "hace 4 d") con
 * fallback a fecha absoluta para fechas antiguas.
 */
export const formatForumRelativeTime = (value: string): string => {
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return "";
  }

  const diffMs = Date.now() - time;
  if (diffMs < 0) {
    return "ahora";
  }

  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) {
    return "ahora";
  }
  if (diffMin < 60) {
    return `hace ${diffMin} min`;
  }

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) {
    return `hace ${diffHours} h`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return "ayer";
  }
  if (diffDays < 7) {
    return `hace ${diffDays} d`;
  }

  return formatDate(value);
};
