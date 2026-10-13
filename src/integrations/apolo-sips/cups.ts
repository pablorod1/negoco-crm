export const APOLO_SIPS_CUPS_REGEX = /^ES\d{16}[A-Z]{2}[A-Z0-9]{0,2}$/;
const APOLO_SIPS_BASE_CUPS_LENGTH = 20;

// APOLO busca el CUPS exacto y cada distribuidora lo guarda con su propio
// sufijo de punto frontera: i-DE (0021) o 0032 sin sufijo, 0022 con "1P",
// e-distribución (0031), UFD (0026), Viesgo (0027), 0113 o 0143 con "0F".
// El gas va sin sufijo.
const APOLO_SIPS_SUFFIX_BY_DISTRIBUTOR: Record<string, string> = {
  "0022": "1P",
  "0026": "0F",
  "0027": "0F",
  "0031": "0F",
  "0113": "0F",
  "0143": "0F",
};
const APOLO_SIPS_FALLBACK_SUFFIXES = ["", "0F", "1P"];

export function sanitizeCups(raw: string): string {
  return raw
    .trim()
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

export function getApoloSipsBaseCups(raw: string): string {
  return sanitizeCups(raw).slice(0, APOLO_SIPS_BASE_CUPS_LENGTH);
}

// Formas del CUPS a probar en APOLO, de más a menos probable: con el sufijo
// que escribió el usuario, con el de su distribuidora y el resto.
export function getApoloSipsCupsCandidates(raw: string): string[] {
  const cups = sanitizeCups(raw);
  const base = getApoloSipsBaseCups(cups);
  const preferredSuffix = APOLO_SIPS_SUFFIX_BY_DISTRIBUTOR[base.slice(2, 6)];
  const candidates = [
    ...(cups.length > APOLO_SIPS_BASE_CUPS_LENGTH ? [cups] : []),
    ...(preferredSuffix === undefined ? [] : [base + preferredSuffix]),
    ...APOLO_SIPS_FALLBACK_SUFFIXES.map((suffix) => base + suffix),
  ];

  return [...new Set(candidates)];
}

export function isValidApoloSipsCups(raw: string): boolean {
  return APOLO_SIPS_CUPS_REGEX.test(sanitizeCups(raw));
}
