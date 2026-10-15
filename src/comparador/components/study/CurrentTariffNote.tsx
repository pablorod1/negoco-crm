"use client";

import { AlertTriangle, LineChart, Repeat } from "lucide-react";
import { cn } from "@/core/utils";
import type { StudyView } from "./api";

const perKwh = (value: number) => value.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
const perMwh = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/**
 * Cómo se ha calculado lo que paga hoy cuando no es un precio fijo: con el
 * mercado (indexada), con la cuota (tarifa plana), o por qué no se sabe.
 */
export function CurrentTariffNote({ study }: { study: StudyView }) {
  const info = study.currentInfo;
  if (!info || study.invoiceReview.required) return null;

  const note = info.unavailable
    ? {
        icon: AlertTriangle,
        box: "bg-warning-50 ring-warning-200",
        iconClass: "text-warning-600",
        title: "No se sabe lo que paga hoy",
        text: info.unavailable,
      }
    : info.pricing === "indexed"
      ? {
          icon: LineChart,
          box: "bg-primary-50 ring-primary-200",
          iconClass: "text-primary-600",
          title: "Tarifa indexada: comparada con el mercado",
          text: [
            "Lo que paga hoy se calcula con el precio del mercado (OMIE) de sus 12 meses de consumo, ponderado por el perfil de consumo de REE",
            info.marketAverage !== null ? `, de media ${perMwh(info.marketAverage)} €/MWh,` : "",
            " más lo que su factura cobra por encima del mercado",
            info.marginOverMarket !== null ? ` (${perKwh(info.marginOverMarket)} €/kWh de media: peajes, cargos y el margen de su comercializadora)` : "",
            ".",
          ].join(""),
        }
      : info.pricing === "flat"
        ? {
            icon: Repeat,
            box: "bg-warning-50 ring-warning-200",
            iconClass: "text-warning-600",
            title: "Tarifa plana",
            text: "Lo que paga hoy es su cuota por 12 meses con IVA. Si supera el consumo anual pactado, su comercializadora le repercutirá el exceso al final del contrato: la propuesta se lo indica.",
          }
        : null;
  if (!note) return null;
  const Icon = note.icon;

  return (
    <div className={cn("flex gap-3 rounded-2xl px-4 py-3 ring-1", note.box)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", note.iconClass)} />
      <div className="text-sm">
        <p className="font-medium text-gray-900">{note.title}</p>
        <p className="mt-0.5 text-gray-600">{note.text}</p>
      </div>
    </div>
  );
}
