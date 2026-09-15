import type { EmailBrandingTheme, ResolvedBranding } from "./types";

export const DEFAULT_BRANDING: ResolvedBranding = {
  tenant: "default",
  isCustom: false,
  displayName: "Negoco Cloud",
  faviconUrl: "/favicon.ico",
  logo: {
    defaultUrl: "/logo_inline.png",
    emailUrl: "https://negococloud.es/favicon.png",
    alt: "Negoco Cloud",
    width: 180,
    height: 60,
  },
  palette: {},
  hero: {
    background: "white",
    border: "transparent",
    padding: "0",
    foreground: "var(--foreground)",
    mutedForeground: "var(--muted-foreground)",
    cardBackground: "rgb(255 255 255 / 0.9)",
    cardForeground: "var(--foreground)",
    cardMutedForeground: "var(--muted-foreground)",
    cardBorder: "#e5e7eb",
  },
  email: {
    fromName: "Negoco Cloud",
    smtpEnvPrefix: "NOREPLY",
  },
};

export const DEFAULT_EMAIL_THEME: EmailBrandingTheme = {
  bodyBg: "#f7f9fc",
  headerBg: "#f0f6ff",
  heading: "#3b82f6",
  buttonBg: "#3b82f6",
  link: "#3b82f6",
  mutedBg: "#f5f7fa",
  subtleBg: "#f0f5fc",
  border: "#e5ebf5",
};

export const FALLBACK_EMAIL_LOGO_URL = DEFAULT_BRANDING.logo.emailUrl;
