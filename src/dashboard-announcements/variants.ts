import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { DashboardAnnouncementVariant } from "./types";

export interface VariantPresentation {
  value: DashboardAnnouncementVariant;
  /** Etiqueta visible para el tipo de aviso. */
  label: string;
  /** Pista corta sobre cuándo usar este tipo. */
  hint: string;
  icon: LucideIcon;
  /** Superficie de la tarjeta (cartel flotante + vista previa). */
  container: string;
  /** Fondo del chip del icono. */
  iconWrap: string;
  /** Color del icono. */
  iconColor: string;
  /** Color de la barra de acento lateral. */
  accent: string;
  /** Botón CTA dentro de la tarjeta. */
  button: string;
  /** Estilo del selector cuando está activo. */
  pickerActive: string;
  /** Estilo del selector en reposo. */
  pickerIdle: string;
  /** Punto de color para indicadores compactos. */
  swatch: string;
}

export const variantConfig: Record<
  DashboardAnnouncementVariant,
  VariantPresentation
> = {
  info: {
    value: "info",
    label: "Informativo",
    hint: "Novedades y comunicados",
    icon: Info,
    container: "border-blue-200 bg-blue-50 text-blue-950",
    iconWrap: "bg-blue-100 text-blue-600",
    iconColor: "text-blue-600",
    accent: "bg-blue-500",
    button: "bg-blue-600 text-white hover:bg-blue-700",
    pickerActive: "border-blue-500 bg-blue-50 ring-2 ring-blue-500/15",
    pickerIdle: "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40",
    swatch: "bg-blue-500",
  },
  warning: {
    value: "warning",
    label: "Aviso",
    hint: "Requiere atención",
    icon: AlertTriangle,
    container: "border-amber-200 bg-amber-50 text-amber-950",
    iconWrap: "bg-amber-100 text-amber-600",
    iconColor: "text-amber-600",
    accent: "bg-amber-500",
    button: "bg-amber-600 text-white hover:bg-amber-700",
    pickerActive: "border-amber-500 bg-amber-50 ring-2 ring-amber-500/15",
    pickerIdle: "border-gray-200 hover:border-amber-300 hover:bg-amber-50/40",
    swatch: "bg-amber-500",
  },
  success: {
    value: "success",
    label: "Confirmación",
    hint: "Algo va bien",
    icon: CheckCircle2,
    container: "border-emerald-200 bg-emerald-50 text-emerald-950",
    iconWrap: "bg-emerald-100 text-emerald-600",
    iconColor: "text-emerald-600",
    accent: "bg-emerald-500",
    button: "bg-emerald-600 text-white hover:bg-emerald-700",
    pickerActive: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/15",
    pickerIdle:
      "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40",
    swatch: "bg-emerald-500",
  },
  danger: {
    value: "danger",
    label: "Urgente",
    hint: "Acción inmediata",
    icon: ShieldAlert,
    container: "border-red-200 bg-red-50 text-red-950",
    iconWrap: "bg-red-100 text-red-600",
    iconColor: "text-red-600",
    accent: "bg-red-500",
    button: "bg-red-600 text-white hover:bg-red-700",
    pickerActive: "border-red-500 bg-red-50 ring-2 ring-red-500/15",
    pickerIdle: "border-gray-200 hover:border-red-300 hover:bg-red-50/40",
    swatch: "bg-red-500",
  },
};

export const variantOrder: DashboardAnnouncementVariant[] = [
  "info",
  "warning",
  "success",
  "danger",
];
