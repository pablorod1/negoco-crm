import type { EnergyByPeriod } from "@/comparador/engine/types";

/**
 * Festivos nacionales de fecha fija, en P3 todo el día. La CNMC (Circular
 * 3/2020) deja fuera los sustituibles y los de fecha variable (Viernes Santo).
 */
const HOLIDAYS = new Set(["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"]);

/** Tipo de día de un día (YYYY-MM-DD): domingos y festivos nacionales son festivos. */
export function dayType(date: string): "laborable" | "sabado" | "festivo" {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || HOLIDAYS.has(date.slice(5))) return "festivo";
  return weekday === 6 ? "sabado" : "laborable";
}

/** Periodo de la 2.0TD de una hora local (0–23) de un día (YYYY-MM-DD), en península. */
export function periodOf(date: string, hour: number): keyof EnergyByPeriod {
  if (dayType(date) !== "laborable") return "P3";
  if (hour < 8) return "P3";
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return "P1";
  return "P2";
}
