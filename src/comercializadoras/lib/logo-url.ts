/**
 * De dónde sale el logo de una comercializadora.
 *
 * La columna `comercializadoras.logo` guarda sólo el nombre del fichero
 * (`ganaenergia.webp`). Los 35 logos históricos viven en `public/companies` y
 * se siguen sirviendo como ficheros estáticos; los que se suben desde el
 * backoffice viven en la base de control y salen por `/api/company-logos`.
 * Así añadir una comercializadora nueva no necesita un despliegue del CRM.
 */

/** Logos que venían en el repo. Cualquier otro nombre se pide a la base de control. */
const BUNDLED_LOGOS = new Set([
  "acciona.webp",
  "adx.webp",
  "airelimpio.webp",
  "aletteo.webp",
  "apolo.webp",
  "audax.webp",
  "axpo.webp",
  "bartv.webp",
  "buala.webp",
  "candela.svg",
  "chc.webp",
  "edp.svg",
  "eleia.webp",
  "endesa.webp",
  "ganaenergia.webp",
  "iberdrola.webp",
  "ignis.webp",
  "imaginaenergia.svg",
  "logos.webp",
  "max.webp",
  "nagini.webp",
  "naturgy.webp",
  "nexus.webp",
  "niba.webp",
  "nordy.svg",
  "octopus.webp",
  "plenitude.webp",
  "quimera.webp",
  "repsol.webp",
  "totalenergies.webp",
  "unielectrica.webp",
  "visalia.webp",
  "vm.webp",
  "yaluz.webp",
  "zima.webp",
]);

const LOGO_FILE_RE = /^[a-z0-9._-]+\.(webp|svg|png|jpg|jpeg)$/;

export function isCompanyLogoFile(file: string): boolean {
  return LOGO_FILE_RE.test(file) && !file.includes("..");
}

/** URL desde la que pintar el logo, o `null` si el nombre no es utilizable. */
export function companyLogoUrl(logo: string | null | undefined): string | null {
  const file = logo?.trim();
  if (!file || !isCompanyLogoFile(file)) return null;
  return BUNDLED_LOGOS.has(file)
    ? `/companies/${file}`
    : `/api/company-logos/${encodeURIComponent(file)}`;
}

/**
 * `next/image` se niega a optimizar SVG salvo con `dangerouslyAllowSVG`, así
 * que los logos vectoriales hay que servirlos tal cual.
 */
export function isUnoptimizedLogo(logo: string | null | undefined): boolean {
  return Boolean(logo?.trim().toLowerCase().endsWith(".svg"));
}
