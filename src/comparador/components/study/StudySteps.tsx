import { Check } from "lucide-react";

const STEPS = ["Factura", "Elegir oferta", "Propuesta al cliente", "Completar"] as const;

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
export function StudySteps({ active }: { active: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Pasos del estudio">
      {STEPS.map((label, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <li key={label} className="flex items-center gap-2 min-w-0" aria-current={current ? "step" : undefined}>
            {index > 0 && <span className={`h-px w-4 sm:w-8 shrink-0 ${done || current ? "bg-primary" : "bg-gray-200"}`} />}
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                done
                  ? "bg-primary text-white"
                  : current
                    ? "border-2 border-primary text-primary"
                    : "border border-gray-300 text-gray-400"
              }`}
            >
              {done ? <Check className="size-3" /> : index + 1}
            </span>
            <span
              className={`hidden md:inline truncate ${current ? "font-medium text-gray-900" : done ? "text-gray-700" : "text-gray-400"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
