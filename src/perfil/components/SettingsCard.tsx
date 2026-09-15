import { cn } from "@/core/utils";

interface SettingsCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Tarjeta base del menú de ajustes (estilo iOS): cabecera opcional con icono,
 * título, descripción y acción a la derecha; cuerpo con el contenido.
 */
export default function SettingsCard({
  title,
  description,
  icon,
  action,
  className,
  bodyClassName,
  children,
}: SettingsCardProps) {
  const hasHeader = Boolean(title || description || icon || action);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm",
        className,
      )}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                {icon}
              </div>
            )}
            <div className="space-y-1">
              {title && (
                <h3 className="text-base font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-gray-500">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(hasHeader ? "px-6 pb-6 pt-6" : "p-6", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
