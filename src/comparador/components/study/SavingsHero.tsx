"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileSearch, TrendingDown } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { SupplierLogo } from "@/comercializadoras/components/SupplierLogo";
import { euros, eurosRound, percentOf, type StudyOfferView, type StudyView } from "./api";

/** Barra de coste anual sobre fondo de marca: la más cara llena la pista. */
function CostBar({ label, value, max, strong }: { label: React.ReactNode; value: number; max: number; strong?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-white/80">{label}</span>
        <span className="font-semibold tabular-nums text-white">{euros(value)}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-white/15">
        <motion.div
          className={`h-2 rounded-full ${strong ? "bg-white" : "bg-white/45"}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, (value / max) * 100)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/**
 * La decisión de un vistazo: cuánto puede ahorrar el cliente y con quién. Con
 * el estudio completado, lo que se le ofreció.
 */
/** La lectura no cuadra: antes de enseñar ahorros, alguien revisa la factura. */
function ReviewHero({ onReview }: { onReview: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-3xl bg-white p-6 ring-1 ring-warning-200 sm:flex-row sm:items-center sm:p-8"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-warning-50 text-warning-600">
        <FileSearch className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-gray-900">Revisa los datos de la factura</p>
        <p className="mt-1 text-sm text-gray-600">
          Las cuentas de la factura leída no cuadran. Hasta que alguien las revise no se calcula lo que paga hoy ni el ahorro, y las
          propuestas salen sin comparar con su factura.
        </p>
      </div>
      <Button size="lg" className="shrink-0 rounded-xl" onClick={onReview}>
        Revisar datos
      </Button>
    </motion.section>
  );
}

export function SavingsHero({ study, best, onReview }: { study: StudyView; best: StudyOfferView | null; onReview: () => void }) {
  if (study.invoiceReview.required) return <ReviewHero onReview={onReview} />;
  const chosen = study.proposals.find((proposal) => proposal.chosen);
  const current = study.current?.total ?? null;
  const target = chosen
    ? { name: chosen.comercializadoraName, product: chosen.productName, total: chosen.annualTotal, savings: chosen.savings, logo: study.offers.find(({ key }) => key === chosen.offerKey)?.comercializadoraLogo ?? null }
    : best
      ? { name: best.comercializadoraName, product: best.productName, total: best.cost.total, savings: best.savings, logo: best.comercializadoraLogo }
      : null;
  const saves = target?.savings !== null && target?.savings !== undefined && target.savings > 0;
  const max = Math.max(current ?? 0, target?.total ?? 0) || 1;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 p-6 text-white shadow-[0_12px_40px_-12px_var(--primary-color-600)] sm:p-8"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-white/5 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-white/75">
            {chosen ? <CheckCircle2 className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {chosen ? "Propuesta aceptada" : saves ? "Ahorro potencial" : current === null ? "Tarifa más barata" : "Sin ahorro"}
          </p>
          {target && (saves || current === null || chosen) ? (
            <>
              <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
                {eurosRound(saves ? target.savings! : target.total)}
                <span className="ml-2 text-lg font-normal text-white/70">/año</span>
              </p>
              <p className="mt-2 text-sm text-white/80">
                {saves && current
                  ? `Un ${percentOf(target.savings!, current)} % menos de lo que paga hoy · unos ${euros(target.savings! / 12)} al mes`
                  : saves
                    ? `Unos ${euros(target.savings! / 12)} al mes`
                    : "Coste de un año con impuestos. La factura no da todos los precios de hoy, así que no hay ahorro que calcular."}
              </p>
              <div className="mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl bg-white/10 py-2 pl-2 pr-4 ring-1 ring-white/15 backdrop-blur">
                <SupplierLogo supplier={{ name: target.name, logo: target.logo }} size={36} className="border-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{target.name}</p>
                  <p className="truncate text-xs text-white/75">{target.product}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold tracking-tight">Ninguna tarifa mejora lo que paga hoy</p>
              <p className="mt-2 max-w-md text-sm text-white/80">
                Con los precios cargados, cambiar de comercializadora no le ahorraría dinero. Mejor no proponer un cambio solo por precio.
              </p>
            </>
          )}
        </div>

        {current !== null && target && (
          <div className="space-y-4 rounded-2xl bg-white/[0.08] p-5 ring-1 ring-white/10 backdrop-blur">
            <CostBar label={study.invoice?.supplierName ? `Hoy con ${study.invoice.supplierName}` : "Hoy"} value={current} max={max} />
            <CostBar
              label={
                <span className="inline-flex items-center gap-1.5">
                  <ArrowRight className="size-3.5" />
                  Con {target.name}
                </span>
              }
              value={target.total}
              max={max}
              strong
            />
            <p className="text-xs text-white/60">Coste de un año con impuestos, con su consumo real y su potencia.</p>
          </div>
        )}
      </div>
    </motion.section>
  );
}
