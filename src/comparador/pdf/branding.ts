import type { NextRequest } from "next/server";
import { getBrandingForRequest } from "@/core/branding/server";
import type { ResolvedBranding } from "@/core/branding/types";
import type { ProposalBranding } from "./proposal-pdf";

const FALLBACK_COLOR = "#2563eb";
const LOGO_TIMEOUT_MS = 5_000;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** El PDF solo admite PNG y JPEG; un SVG o WebP se cambia por el nombre. */
function isPngOrJpeg(data: Buffer): boolean {
  const png = data.length > 8 && data[0] === 0x89 && data.subarray(1, 4).toString("ascii") === "PNG";
  const jpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  return png || jpeg;
}

async function fetchLogo(url: string, origin: string): Promise<Buffer | null> {
  try {
    const response = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(LOGO_TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    return data.length <= MAX_LOGO_BYTES && isPngOrJpeg(data) ? data : null;
  } catch {
    return null;
  }
}

/** Color principal de la marca, si es uno que el PDF entiende (hex o rgb). */
export function brandColor(branding: Pick<ResolvedBranding, "palette">): string {
  const primary = branding.palette.primary;
  const color = primary?.["600"] ?? primary?.DEFAULT ?? primary?.["500"];
  return color && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(color.trim()) ? color.trim() : FALLBACK_COLOR;
}

/** Nombre, logo y color del tenant para el PDF de una propuesta. */
export async function proposalBranding(request: NextRequest): Promise<ProposalBranding> {
  const branding = await getBrandingForRequest(request);
  const origin = request.nextUrl.origin;
  const candidates = [branding.logo.defaultUrl, branding.logo.emailUrl].filter(Boolean);
  let logo: Buffer | null = null;
  for (const url of new Set(candidates)) {
    logo = await fetchLogo(url, origin);
    if (logo) break;
  }
  return { displayName: branding.displayName, logo, color: brandColor(branding) };
}
