import { Check } from "lucide-react";
import { cn } from "@/core/utils";

const STEPS = ["Factura", "Ofertas", "Propuestas", "Completar"] as const;

/**
 * Dónde está el estudio: 0 eligiendo factura, 1 eligiendo oferta, 3 con
 * propuestas por completar y 4 completado.
 */
export function studyStep({ picking, proposals, closed }: { picking: boolean; proposals: number; closed: boolean }) {
  if (picking) return 0;
  if (closed) return STEPS.length;
  return proposals > 0 ? 3 : 1;
}

/** Los pasos del estudio, para saber siempre qué toca ahora. */
export function StudySteps({ active, className }: { active: number; className?: string }) {
  return (
    <ol
      className={cn("flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-gray-950/[0.06]", className)}
      aria-label="Pasos del estudio"
    >
      {STEPS.map((label, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
              current && "bg-primary-50 font-medium text-primary-700",
              done && "text-gray-700",
              !done && !current && "text-gray-400",
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                done && "bg-primary-600 text-white",
                current && "bg-primary-600 text-white",
                !done && !current && "ring-1 ring-gray-300",
              )}
            >
              {done ? <Check className="size-2.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
