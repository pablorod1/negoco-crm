export const APOLO_SIPS_CUPS_REGEX = /^ES\d{16}[A-Z]{2}[A-Z0-9]{0,2}$/;
const APOLO_SIPS_BASE_CUPS_LENGTH = 20;

export function sanitizeCups(raw: string): string {
  return raw
    .trim()
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

export function getApoloSipsBaseCups(raw: string): string {
  return sanitizeCups(raw).slice(0, APOLO_SIPS_BASE_CUPS_LENGTH);
}

export function isValidApoloSipsCups(raw: string): boolean {
  return APOLO_SIPS_CUPS_REGEX.test(sanitizeCups(raw));
}
