import type { ResolvedBranding } from "./types";
import type { CSSProperties } from "react";

const COLOR_TOKEN_NAMES = {
  primary: "primary-color",
  secondary: "secondary-color",
  info: "info-color",
  pending: "pending-color",
  success: "success-color",
  danger: "danger-color",
  warning: "warning-color",
} as const;

export function getBrandingCssVariables(
  branding: ResolvedBranding,
): CSSProperties {
  const variables: Record<string, string> = {};

  for (const [paletteKey, cssToken] of Object.entries(COLOR_TOKEN_NAMES)) {
    const scale = branding.palette[paletteKey as keyof typeof COLOR_TOKEN_NAMES];
    if (!scale) continue;

    for (const [shade, value] of Object.entries(scale)) {
      if (!value) continue;
      const token = shade === "DEFAULT" ? `--${cssToken}` : `--${cssToken}-${shade}`;
      variables[token] = value;
    }
  }

  variables["--bg-hero"] = branding.hero.background;
  variables["--hero-border"] = branding.hero.border;
  variables["--hero-padding"] = branding.hero.padding;
  variables["--hero-foreground"] = branding.hero.foreground;
  variables["--hero-muted-foreground"] = branding.hero.mutedForeground;
  variables["--hero-card-background"] = branding.hero.cardBackground;
  variables["--hero-card-foreground"] = branding.hero.cardForeground;
  variables["--hero-card-muted-foreground"] = branding.hero.cardMutedForeground;
  variables["--hero-card-border"] = branding.hero.cardBorder;

  return variables as CSSProperties;
}
