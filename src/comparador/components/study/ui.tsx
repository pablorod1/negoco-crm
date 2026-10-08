import type { ReactNode } from "react";
import { cn } from "@/core/utils";

/** Superficie de la vista del estudio: blanca, borde casi invisible y sombra mínima. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl bg-white ring-1 ring-gray-950/[0.06] shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {children}
    </section>
  );
}

/** Etiqueta pequeña en versalitas sobre un dato o un bloque. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500", className)}>{children}</p>;
}

/** Cabecera de un panel: título, explicación corta y acciones a la derecha. */
export function PanelHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
