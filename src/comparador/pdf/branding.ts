import { readFile } from "node:fs/promises";
import path from "node:path";
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

const PUBLIC_DIR = path.join(process.cwd(), "public");

/**
 * Un logo de la app (`/logo_inline.png`) se lee de `public/`: pedirlo por HTTP
 * sin sesión lo redirige al login. Uno externo (Storage) se descarga.
 */
async function readLogo(url: string): Promise<Buffer | null> {
  try {
    let data: Buffer;
    if (url.startsWith("/") && !url.startsWith("//")) {
      const file = path.join(PUBLIC_DIR, decodeURIComponent(url.split(/[?#]/)[0]));
      if (!file.startsWith(PUBLIC_DIR + path.sep)) return null;
      data = await readFile(file);
    } else {
      const response = await fetch(url, { signal: AbortSignal.timeout(LOGO_TIMEOUT_MS) });
      if (!response.ok) return null;
      data = Buffer.from(await response.arrayBuffer());
    }
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
  const candidates = [branding.logo.defaultUrl, branding.logo.emailUrl].filter(Boolean);
  let logo: Buffer | null = null;
  for (const url of new Set(candidates)) {
    logo = await readLogo(url);
    if (logo) break;
  }
  return { displayName: branding.displayName, logo, color: brandColor(branding) };
}
