export type BrandShade =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "950";

export type BrandColorScale = Partial<
  Record<BrandShade | "DEFAULT", string>
>;

export type BrandPaletteKey =
  | "primary"
  | "secondary"
  | "info"
  | "pending"
  | "success"
  | "danger"
  | "warning";

export type BrandPalette = Partial<Record<BrandPaletteKey, BrandColorScale>>;

export interface BrandLogoConfig {
  defaultUrl?: string;
  emailUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface BrandHeroConfig {
  background?: string;
  border?: string;
  padding?: string;
  foreground?: string;
  mutedForeground?: string;
  cardBackground?: string;
  cardForeground?: string;
  cardMutedForeground?: string;
  cardBorder?: string;
}

export interface EmailBrandingConfig {
  fromName?: string;
  smtpEnvPrefix?: string;
}

export interface BrandingConfig {
  enabled?: boolean;
  displayName?: string;
  faviconUrl?: string;
  logo?: BrandLogoConfig;
  palette?: BrandPalette;
  hero?: BrandHeroConfig;
  email?: EmailBrandingConfig;
}

export interface OrganizationBrandingSource {
  tenant: string;
  name?: string | null;
  logo?: string | null;
  plan?: string | null;
  metadata?: string | null;
}

export interface ResolvedBranding {
  tenant: string;
  isCustom: boolean;
  displayName: string;
  faviconUrl: string;
  logo: Required<BrandLogoConfig>;
  palette: BrandPalette;
  hero: Required<BrandHeroConfig>;
  email: Required<EmailBrandingConfig>;
}

export interface EmailBrandingTheme {
  bodyBg: string;
  headerBg: string;
  heading: string;
  buttonBg: string;
  link: string;
  mutedBg: string;
  subtleBg: string;
  border: string;
}

export interface ResolvedEmailBranding {
  branding: ResolvedBranding;
  theme: EmailBrandingTheme;
  logoUrl: string;
  fromName: string;
  address: string;
  password: string;
  smtpHost: string | undefined;
}
