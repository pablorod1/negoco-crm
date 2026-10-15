"use client";

import type { InvoiceIssue } from "@/comparador/extraction/validate";
import { expectedGasTaxableBase } from "@/comparador/gas/invoice";
import type { GasInvoiceExtraction } from "@/comparador/gas/invoice-schema";
import { AddButton, AmountLines, Expected, flaggedBy, Num, RemoveButton, Section } from "./editor-fields";

type Gas = GasInvoiceExtraction;
type Discount = Gas["discounts"][number];

const DISCOUNT_BASES: { value: Discount["appliesTo"]; label: string }[] = [
  { value: "energy", label: "Variable" },
  { value: "fixed", label: "Fijo" },
  { value: "both", label: "Los dos" },
  { value: "amount", label: "Importe" },
];

/** Los datos de una factura de gas, editables y validados mientras se escriben. */
export function GasInvoiceForm({ gas, setGas, issues }: { gas: Gas; setGas: (update: (gas: Gas) => Gas) => void; issues: InvoiceIssue[] }) {
  const set = <K extends keyof Gas>(key: K, value: Gas[K]) => setGas((current) => ({ ...current, [key]: value }));
  const days = gas.billingPeriod?.days ?? null;

  return (
    <div className="space-y-4">
      <Section
        title="Periodo y consumo"
        hint="Días facturados y consumo de gas del periodo (kWh; si la factura da m³, también el factor de conversión)."
        flagged={flaggedBy(issues, "billingPeriod") || flaggedBy(issues, "consumptionKwh")}
      >
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <label className="space-y-1">
            <span className="text-gray-500">Días facturados</span>
            <Num
              label="Días facturados"
              value={days}
              invalid={flaggedBy(issues, "billingPeriod")}
              onChange={(value) => set("billingPeriod", { from: gas.billingPeriod?.from ?? null, to: gas.billingPeriod?.to ?? null, days: Math.round(value ?? 0) })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500">Consumo (kWh)</span>
            <Num label="Consumo kWh" value={gas.consumptionKwh} invalid={flaggedBy(issues, "consumptionKwh")} onChange={(value) => set("consumptionKwh", value)} />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500">Consumo (m³)</span>
            <Num label="Consumo m3" value={gas.consumptionM3} onChange={(value) => set("consumptionM3", value)} />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500">Factor (kWh/m³)</span>
            <Num label="Factor de conversión" value={gas.conversionFactor} onChange={(value) => set("conversionFactor", value)} />
          </label>
        </div>
      </Section>

      <Section
        title="Término fijo"
        hint="Días × €/día. Si la factura lo da al mes, el precio al mes y los meses facturados."
        flagged={flaggedBy(issues, "fixedTermLines")}
        action={<AddButton onClick={() => set("fixedTermLines", [...gas.fixedTermLines, { days, pricePerDay: 0, originalPrice: null, amount: 0 }])}>Línea</AddButton>}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1.3fr_1.2fr_2rem] gap-2 text-[11px] text-gray-500">
            <span className="text-right">Días</span><span className="text-right">€/día</span><span className="text-right">Importe</span><span />
          </div>
          {gas.fixedTermLines.map((line, index) => {
            const update = (patch: Partial<typeof line>) => set("fixedTermLines", gas.fixedTermLines.map((item, at) => (at === index ? { ...item, ...patch } : item)));
            const lineDays = line.days ?? days;
            return (
              <div key={`${index}/${gas.fixedTermLines.length}`} className="grid grid-cols-[1fr_1.3fr_1.2fr_2rem] items-start gap-2">
                <Num label="Días" value={line.days} onChange={(value) => update({ days: value })} />
                <div>
                  {/* Cambiar el €/día deja de usar el precio al mes que venía en la factura. */}
                  <Num label="Precio €/día" value={line.pricePerDay} onChange={(value) => update({ pricePerDay: value, originalPrice: null })} />
                  {line.originalPrice && (
                    <p className="mt-0.5 text-right text-[11px] tabular-nums text-gray-500">
                      {line.originalPrice.price} €/{line.originalPrice.unit}
                      {line.originalPrice.months !== null ? ` × ${line.originalPrice.months} meses` : ""}
                    </p>
                  )}
                </div>
                <div>
                  <Num label="Importe" value={line.amount} invalid={flaggedBy(issues, `fixedTermLines[${index}]`)} onChange={(value) => update({ amount: value ?? 0 })} />
                  <Expected
                    expected={
                      line.originalPrice
                        ? line.originalPrice.months !== null
                          ? line.originalPrice.months * line.originalPrice.price
                          : null
                        : lineDays !== null && line.pricePerDay !== null
                          ? lineDays * line.pricePerDay
                          : null
                    }
                    amount={line.amount}
                  />
                </div>
                <RemoveButton onClick={() => set("fixedTermLines", gas.fixedTermLines.filter((_, at) => at !== index))} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Término variable"
        hint="Una línea por tramo de fechas o concepto: kWh × €/kWh."
        flagged={flaggedBy(issues, "energyLines")}
        action={<AddButton onClick={() => set("energyLines", [...gas.energyLines, { kwh: gas.consumptionKwh ?? 0, pricePerKwh: 0, amount: 0 }])}>Línea</AddButton>}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1.3fr_1.2fr_2rem] gap-2 text-[11px] text-gray-500">
            <span className="text-right">kWh</span><span className="text-right">€/kWh</span><span className="text-right">Importe</span><span />
          </div>
          {gas.energyLines.map((line, index) => {
            const update = (patch: Partial<typeof line>) => set("energyLines", gas.energyLines.map((item, at) => (at === index ? { ...item, ...patch } : item)));
            return (
              <div key={`${index}/${gas.energyLines.length}`} className="grid grid-cols-[1fr_1.3fr_1.2fr_2rem] items-start gap-2">
                <Num label="kWh" value={line.kwh} onChange={(value) => update({ kwh: value ?? 0 })} />
                <Num label="Precio €/kWh" value={line.pricePerKwh} onChange={(value) => update({ pricePerKwh: value ?? 0 })} />
                <div>
                  <Num label="Importe" value={line.amount} invalid={flaggedBy(issues, `energyLines[${index}]`)} onChange={(value) => update({ amount: value ?? 0 })} />
                  <Expected expected={line.kwh * line.pricePerKwh} amount={line.amount} />
                </div>
                <RemoveButton onClick={() => set("energyLines", gas.energyLines.filter((_, at) => at !== index))} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Descuentos"
        hint="En negativo, con lo que descuentan: el variable, el fijo, los dos o un importe."
        action={<AddButton onClick={() => set("discounts", [...gas.discounts, { description: "Descuento", appliesTo: "energy", amount: 0 }])}>Descuento</AddButton>}
      >
        {gas.discounts.length === 0 ? (
          <p className="text-xs text-gray-400">Sin descuentos.</p>
        ) : (
          <div className="space-y-2">
            {gas.discounts.map((line, index) => {
              const update = (patch: Partial<Discount>) => set("discounts", gas.discounts.map((item, at) => (at === index ? { ...item, ...patch } : item)));
              return (
                <div key={`${index}/${gas.discounts.length}`} className="grid grid-cols-[1fr_6rem_7rem_2rem] items-center gap-2">
                  <input
                    aria-label="Concepto"
                    value={line.description}
                    onChange={(event) => update({ description: event.target.value })}
                    className="h-8 w-full rounded-lg bg-white px-2 text-sm ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <select
                    aria-label="Sobre"
                    value={line.appliesTo}
                    onChange={(event) => update({ appliesTo: event.target.value as Discount["appliesTo"] })}
                    className="h-8 rounded-lg bg-white px-1.5 text-sm ring-1 ring-gray-200"
                  >
                    {DISCOUNT_BASES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Num label="Importe" value={line.amount} onChange={(value) => update({ amount: value ?? 0 })} />
                  <RemoveButton onClick={() => set("discounts", gas.discounts.filter((_, at) => at !== index))} />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Impuesto de hidrocarburos" flagged={flaggedBy(issues, "hydrocarbonTax")}>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(
              [
                ["kwh", "kWh"],
                ["ratePerKwh", "€/kWh"],
                ["amount", "Importe"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-gray-500">{label}</span>
                <Num
                  label={`Hidrocarburos: ${label}`}
                  value={gas.hydrocarbonTax?.[key] ?? null}
                  invalid={key === "amount" && flaggedBy(issues, "hydrocarbonTax")}
                  onChange={(value) =>
                    set("hydrocarbonTax", {
                      kwh: gas.hydrocarbonTax?.kwh ?? gas.consumptionKwh,
                      ratePerKwh: gas.hydrocarbonTax?.ratePerKwh ?? null,
                      amount: gas.hydrocarbonTax?.amount ?? 0,
                      [key]: key === "amount" ? (value ?? 0) : value,
                    })
                  }
                />
              </label>
            ))}
          </div>
        </Section>
        <Section title="Alquiler del contador" flagged={flaggedBy(issues, "meterRental")}>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(
              [
                ["days", "Días"],
                ["pricePerDay", "€/día"],
                ["amount", "Importe"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-gray-500">{label}</span>
                <Num
                  label={`Contador: ${label}`}
                  value={gas.meterRental?.[key] ?? null}
                  invalid={key === "amount" && flaggedBy(issues, "meterRental")}
                  onChange={(value) =>
                    set("meterRental", {
                      days: gas.meterRental?.days ?? null,
                      pricePerDay: gas.meterRental?.pricePerDay ?? null,
                      amount: gas.meterRental?.amount ?? 0,
                      [key]: key === "amount" ? (value ?? 0) : value,
                    })
                  }
                />
              </label>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Cargos regulados" hint="Canon IRC, cuota GTS, tasa CNMC: van también en las ofertas." action={<AddButton onClick={() => set("regulatedLines", [...gas.regulatedLines, { description: "Canon IRC", amount: 0 }])}>Concepto</AddButton>}>
          <AmountLines lines={gas.regulatedLines} onChange={(lines) => set("regulatedLines", lines)} field="regulatedLines" issues={issues} placeholder="Ninguno." />
        </Section>
        <Section title="Servicios" hint="Mantenimiento, packs… (cada factura)." action={<AddButton onClick={() => set("otherTaxableLines", [...gas.otherTaxableLines, { description: "Servicio", amount: 0 }])}>Concepto</AddButton>}>
          <AmountLines lines={gas.otherTaxableLines} onChange={(lines) => set("otherTaxableLines", lines)} field="otherTaxableLines" issues={issues} placeholder="Ninguno." />
        </Section>
        <Section title="Cargos de una vez" hint="Inspección, alta… (no se repiten)." action={<AddButton onClick={() => set("oneOffLines", [...gas.oneOffLines, { description: "Inspección periódica", amount: 0 }])}>Concepto</AddButton>}>
          <AmountLines lines={gas.oneOffLines} onChange={(lines) => set("oneOffLines", lines)} field="oneOffLines" issues={issues} placeholder="Ninguno." />
        </Section>
        <Section title="Conceptos sin IVA" action={<AddButton onClick={() => set("vatExemptLines", [...gas.vatExemptLines, { description: "Concepto", amount: 0 }])}>Concepto</AddButton>}>
          <AmountLines lines={gas.vatExemptLines} onChange={(lines) => set("vatExemptLines", lines)} field="vatExemptLines" issues={issues} placeholder="Ninguno." />
        </Section>
      </div>

      <Section
        title="IVA y total"
        hint="Una línea por tipo de IVA (en 2026, el gas puede ir al 10 % y el contador al 21 %)."
        flagged={flaggedBy(issues, "vat") || flaggedBy(issues, "vatLines") || flaggedBy(issues, "total")}
        action={<AddButton onClick={() => set("vatLines", [...gas.vatLines, { ratePercent: 21, base: 0, amount: 0 }])}>Tipo de IVA</AddButton>}
      >
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 text-[11px] text-gray-500">
            <span className="text-right">Base</span><span className="text-right">IVA (%)</span><span className="text-right">IVA</span><span />
          </div>
          {gas.vatLines.map((line, index) => {
            const update = (patch: Partial<typeof line>) => set("vatLines", gas.vatLines.map((item, at) => (at === index ? { ...item, ...patch } : item)));
            return (
              <div key={`${index}/${gas.vatLines.length}`} className="grid grid-cols-[1fr_1fr_1fr_2rem] items-start gap-2">
                <Num label="Base" value={line.base} invalid={flaggedBy(issues, "vat.base")} onChange={(value) => update({ base: value ?? 0 })} />
                <Num label="IVA (%)" value={line.ratePercent} onChange={(value) => update({ ratePercent: value ?? 0 })} />
                <div>
                  <Num label="IVA" value={line.amount} invalid={flaggedBy(issues, `vatLines[${index}]`)} onChange={(value) => update({ amount: value ?? 0 })} />
                  <Expected expected={(line.base * line.ratePercent) / 100} amount={line.amount} />
                </div>
                <RemoveButton onClick={() => set("vatLines", gas.vatLines.filter((_, at) => at !== index))} />
              </div>
            );
          })}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <p className="text-gray-500">
              Base que sale de las líneas: <span className="tabular-nums text-gray-900">{expectedGasTaxableBase(gas).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
            </p>
            <label className="space-y-1">
              <span className="text-gray-500">Total factura</span>
              <Num label="Total factura" value={gas.total} invalid={flaggedBy(issues, "total")} onChange={(value) => set("total", value)} />
            </label>
          </div>
        </div>
      </Section>
    </div>
  );
}
