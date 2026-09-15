import { DEFAULT_BRANDING } from "./defaults";
import type {
  BrandColorScale,
  BrandHeroConfig,
  BrandLogoConfig,
  BrandingConfig,
  BrandPalette,
  EmailBrandingConfig,
  OrganizationBrandingSource,
  ResolvedBranding,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readColorScale(value: unknown): BrandColorScale | undefined {
  if (!isRecord(value)) return undefined;

  const scale: BrandColorScale = {};
  for (const key of [
    "50",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
    "950",
    "DEFAULT",
  ] as const) {
    const color = readString(value[key]);
    if (color) scale[key] = color;
  }

  return Object.keys(scale).length > 0 ? scale : undefined;
}

function readPalette(value: unknown): BrandPalette | undefined {
  if (!isRecord(value)) return undefined;

  const palette: BrandPalette = {};
  for (const key of [
    "primary",
    "secondary",
    "info",
    "pending",
    "success",
    "danger",
    "warning",
  ] as const) {
    const scale = readColorScale(value[key]);
    if (scale) palette[key] = scale;
  }

  return Object.keys(palette).length > 0 ? palette : undefined;
}

function readLogo(value: unknown): BrandLogoConfig | undefined {
  if (!isRecord(value)) return undefined;

  const logo: BrandLogoConfig = {
    defaultUrl: readString(value.defaultUrl),
    emailUrl: readString(value.emailUrl),
    alt: readString(value.alt),
    width: readNumber(value.width),
    height: readNumber(value.height),
  };

  return Object.values(logo).some((item) => item !== undefined) ? logo : undefined;
}

function readHero(value: unknown): BrandHeroConfig | undefined {
  if (!isRecord(value)) return undefined;

  const hero: BrandHeroConfig = {
    background: readString(value.background),
    border: readString(value.border),
    padding: readString(value.padding),
    foreground: readString(value.foreground),
    mutedForeground: readString(value.mutedForeground),
    cardBackground: readString(value.cardBackground),
    cardForeground: readString(value.cardForeground),
    cardMutedForeground: readString(value.cardMutedForeground),
    cardBorder: readString(value.cardBorder),
  };

  return Object.values(hero).some((item) => item !== undefined) ? hero : undefined;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace("#", "");
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function getRelativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [srgbR, srgbG, srgbB] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgbR + 0.7152 * srgbG + 0.0722 * srgbB;
}

function shouldUseLightHeroText(background: string | undefined): boolean {
  if (!background) return false;
  if (/\bblack\b/i.test(background)) return true;
  if (/\bwhite\b/i.test(background)) return false;

  const colors = background.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi) || [];
  const luminances = colors
    .map(hexToRgb)
    .filter((color): color is { r: number; g: number; b: number } => color !== null)
    .map(getRelativeLuminance);

  if (luminances.length === 0) return false;

  const averageLuminance =
    luminances.reduce((total, luminance) => total + luminance, 0) / luminances.length;

  return averageLuminance < 0.42;
}

function getDefaultHeroTextColors(background: string | undefined): {
  foreground: string;
  mutedForeground: string;
} {
  if (shouldUseLightHeroText(background)) {
    return {
      foreground: "#ffffff",
      mutedForeground: "rgb(255 255 255 / 0.82)",
    };
  }

  return {
    foreground: "#0f172a",
    mutedForeground: "#475569",
  };
}

function readEmail(value: unknown): EmailBrandingConfig | undefined {
  if (!isRecord(value)) return undefined;

  const email: EmailBrandingConfig = {
    fromName: readString(value.fromName),
    smtpEnvPrefix: readString(value.smtpEnvPrefix)?.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
  };

  return Object.values(email).some((item) => item !== undefined) ? email : undefined;
}

export function parseBrandingMetadata(metadata: string | null | undefined): BrandingConfig | null {
  if (!metadata) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !isRecord(parsed.branding)) return null;

  const branding = parsed.branding;
  return {
    enabled: branding.enabled === true,
    displayName: readString(branding.displayName),
    faviconUrl: readString(branding.faviconUrl),
    logo: readLogo(branding.logo),
    palette: readPalette(branding.palette),
    hero: readHero(branding.hero),
    email: readEmail(branding.email),
  };
}

function isElitePlan(plan: string | null | undefined): boolean {
  return plan?.toLowerCase() === "elite";
}

export function resolveBrandingFromOrganization(
  source: OrganizationBrandingSource,
): ResolvedBranding {
  const config = parseBrandingMetadata(source.metadata);

  if (!isElitePlan(source.plan) || config?.enabled !== true) {
    return {
      ...DEFAULT_BRANDING,
      tenant: source.tenant,
    };
  }

  const displayName = config.displayName || source.name || DEFAULT_BRANDING.displayName;
  const defaultLogo = config.logo?.defaultUrl || source.logo || DEFAULT_BRANDING.logo.defaultUrl;
  const emailLogo = config.logo?.emailUrl || defaultLogo || DEFAULT_BRANDING.logo.emailUrl;
  const heroBackground = config.hero?.background || DEFAULT_BRANDING.hero.background;
  const defaultHeroTextColors = getDefaultHeroTextColors(heroBackground);

  return {
    tenant: source.tenant,
    isCustom: true,
    displayName,
    faviconUrl: config.faviconUrl || DEFAULT_BRANDING.faviconUrl,
    logo: {
      defaultUrl: defaultLogo,
      emailUrl: emailLogo,
      alt: config.logo?.alt || displayName,
      width: config.logo?.width || DEFAULT_BRANDING.logo.width,
      height: config.logo?.height || DEFAULT_BRANDING.logo.height,
    },
    palette: config.palette || DEFAULT_BRANDING.palette,
    hero: {
      background: heroBackground,
      border: config.hero?.border || DEFAULT_BRANDING.hero.border,
      padding: config.hero?.padding || DEFAULT_BRANDING.hero.padding,
      foreground: config.hero?.foreground || defaultHeroTextColors.foreground,
      mutedForeground:
        config.hero?.mutedForeground || defaultHeroTextColors.mutedForeground,
      cardBackground:
        config.hero?.cardBackground || DEFAULT_BRANDING.hero.cardBackground,
      cardForeground:
        config.hero?.cardForeground || DEFAULT_BRANDING.hero.cardForeground,
      cardMutedForeground:
        config.hero?.cardMutedForeground ||
        DEFAULT_BRANDING.hero.cardMutedForeground,
      cardBorder: config.hero?.cardBorder || DEFAULT_BRANDING.hero.cardBorder,
    },
    email: {
      fromName: config.email?.fromName || displayName,
      smtpEnvPrefix: config.email?.smtpEnvPrefix || DEFAULT_BRANDING.email.smtpEnvPrefix,
    },
  };
}
