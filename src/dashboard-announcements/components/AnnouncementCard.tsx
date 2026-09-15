import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";
import type { DashboardAnnouncementVariant } from "../types";
import { variantConfig } from "../variants";

interface AnnouncementCardProps {
  variant: DashboardAnnouncementVariant;
  title: string;
  message: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  /** Controles superiores (editar / colapsar) del cartel real. */
  actions?: ReactNode;
  /** Modo vista previa: el CTA no navega. */
  preview?: boolean;
  className?: string;
}

/**
 * Tarjeta presentacional del cartel. La comparten el cartel flotante del
 * dashboard y la vista previa del panel de configuración, de modo que lo que
 * se configura es exactamente lo que se ve.
 */
export default function AnnouncementCard({
  variant,
  title,
  message,
  ctaLabel,
  ctaUrl,
  actions,
  preview = false,
  className,
}: AnnouncementCardProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const hasCta = Boolean(ctaLabel && ctaUrl);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border pl-1.5",
        config.container,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1.5", config.accent)}
      />
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
            config.iconWrap,
          )}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                {config.label}
              </p>
              <h2 className="mt-0.5 text-sm font-semibold leading-5">
                {title}
              </h2>
            </div>
            {actions ? (
              <div className="flex shrink-0 items-center gap-1">{actions}</div>
            ) : null}
          </div>

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 opacity-90">
            {message}
          </p>

          {hasCta ? (
            preview ? (
              <span
                className={cn(
                  "mt-4 inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-medium",
                  config.button,
                )}
              >
                {ctaLabel}
                <ExternalLink className="size-4" />
              </span>
            ) : (
              <Button asChild size="sm" className={cn("mt-4", config.button)}>
                <a href={ctaUrl ?? "#"}>
                  {ctaLabel}
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
