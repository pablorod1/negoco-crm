import { FALLBACK_EMAIL_LOGO_URL, DEFAULT_EMAIL_THEME } from "./defaults";
import { getBrandingForRequest } from "./server";
import type { ResolvedBranding, ResolvedEmailBranding } from "./types";

function getPrimaryColor(branding: ResolvedBranding, fallback: string): string {
  return (
    branding.palette.primary?.DEFAULT ||
    branding.palette.primary?.["500"] ||
    fallback
  );
}

function getLightPrimaryColor(branding: ResolvedBranding, fallback: string): string {
  return (
    branding.palette.primary?.["100"] ||
    branding.palette.primary?.["50"] ||
    fallback
  );
}

function getHeaderColor(branding: ResolvedBranding): string {
  return branding.isCustom
    ? getPrimaryColor(branding, DEFAULT_EMAIL_THEME.headerBg)
    : DEFAULT_EMAIL_THEME.headerBg;
}

export function getEmailTheme(branding: ResolvedBranding) {
  if (!branding.isCustom) return DEFAULT_EMAIL_THEME;

  const primary = getPrimaryColor(branding, DEFAULT_EMAIL_THEME.buttonBg);
  const subtle = getLightPrimaryColor(branding, DEFAULT_EMAIL_THEME.subtleBg);

  return {
    bodyBg: branding.palette.primary?.["50"] || DEFAULT_EMAIL_THEME.bodyBg,
    headerBg: getHeaderColor(branding),
    heading: primary,
    buttonBg: primary,
    link: primary,
    mutedBg: subtle,
    subtleBg: subtle,
    border: branding.palette.primary?.["200"] || subtle,
  };
}

function getEnvValue(prefix: string, name: "EMAIL" | "EMAIL_PASS") {
  return process.env[`${name}_${prefix}`];
}

export async function resolveEmailBranding({
  req,
  logoUrl,
}: {
  req: Request;
  logoUrl?: string | null;
}): Promise<ResolvedEmailBranding> {
  const branding = await getBrandingForRequest(req);
  const prefix = branding.email.smtpEnvPrefix;
  const prefixedEmail = getEnvValue(prefix, "EMAIL");
  const prefixedPassword = getEnvValue(prefix, "EMAIL_PASS");

  const address =
    (branding.isCustom ? prefixedEmail : undefined) ||
    process.env.EMAIL_NOREPLY ||
    process.env.EMAIL ||
    "";
  const password =
    (branding.isCustom ? prefixedPassword : undefined) ||
    process.env.EMAIL_PASS_NOREPLY ||
    process.env.EMAIL_PASS ||
    "";

  return {
    branding,
    theme: getEmailTheme(branding),
    logoUrl: branding.isCustom
      ? logoUrl || branding.logo.emailUrl
      : FALLBACK_EMAIL_LOGO_URL,
    fromName: branding.email.fromName,
    address,
    password,
    smtpHost: process.env.SMTP_HOST,
  };
}

export function getEmailTransportConfig(emailBranding: ResolvedEmailBranding) {
  return {
    host: emailBranding.smtpHost,
    port: 465,
    secure: true,
    auth: {
      user: emailBranding.address,
      pass: emailBranding.password,
    },
  };
}

export function getEmailFrom(emailBranding: ResolvedEmailBranding) {
  return {
    address: emailBranding.address,
    name: emailBranding.fromName,
  };
}
