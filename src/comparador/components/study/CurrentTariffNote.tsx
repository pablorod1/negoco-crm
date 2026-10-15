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
  const gas = study.supply?.energy === "gas";

  const note = info.unavailable
    ? {
        icon: AlertTriangle,
        box: "bg-warning-50 ring-warning-200",
        iconClass: "text-warning-600",
        title: "No se sabe lo que paga hoy",
        text: info.unavailable,
      }
    : info.pricing === "indexed" && gas
      ? {
          icon: LineChart,
          box: "bg-warning-50 ring-warning-200",
          iconClass: "text-warning-600",
          title: "Gas indexado: calculado con el precio de esta factura",
          text: "Lo que paga hoy lleva el precio de esta factura en los 12 meses. El precio del gas indexado cambia cada mes con el mercado (MIBGAS): compruébalo con otras facturas del cliente antes de proponer.",
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
  const notes = [
    study.supply?.estimate
      ? {
          icon: AlertTriangle,
          box: "bg-warning-50 ring-warning-200",
          iconClass: "text-warning-600",
          title: "Consumo estimado con la factura",
          text: `${study.supply.estimate.reason === "chosen" ? "Estudio sin SIPS" : "El SIPS no tiene 12 meses de este suministro"}: el consumo de un año es el de la factura (${study.supply.estimate.invoiceDays} días) llevado a 365 días. El ahorro es una estimación y la propuesta lo dice.`,
        }
      : null,
    note,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  if (notes.length === 0) return null;

  return (
    <div className="space-y-3">
      {notes.map(({ icon: Icon, box, iconClass, title, text }) => (
        <div key={title} className={cn("flex gap-3 rounded-2xl px-4 py-3 ring-1", box)}>
          <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
          <div className="text-sm">
            <p className="font-medium text-gray-900">{title}</p>
            <p className="mt-0.5 text-gray-600">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
