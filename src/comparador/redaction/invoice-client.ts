import { isValidSpanishTaxId, normalizeIdentifier } from "@/comparador/extraction/identifiers";
import { isValidIban, type StudyClientData } from "@/comparador/study/client-data";

/**
 * Datos del titular leídos en local del texto de la factura, sin IA: rellenan
 * de antemano los datos del cliente del estudio (y con ellos el trámite).
 * Nunca se envían fuera del CRM. Solo se toma lo que la factura dice con su
 * etiqueta: ante la duda, el campo se queda vacío y lo escribe una persona.
 */

const HOLDER = /\b(?:titular(?: del contrato| del suministro)?|nombre(?: y apellidos)?|raz[oó]n social)\s*[:\-]\s*(.+)$/i;
const SUPPLY_ADDRESS = /\bdirecci[oó]n (?:del |de )?(?:suministro|punto de suministro)\s*[:\-]?\s*(.*)$/i;
const POSTAL_AND_CITY = /\b((?:0[1-9]|[1-4]\d|5[0-2])\d{3})\b[\s,-]*([\p{L}][\p{L}' .-]*[\p{L}])?/u;
/** Lo que corta el nombre del titular: otra etiqueta en la misma línea. */
const HOLDER_STOP = /\s{2,}|\s+(?:NIF|N\.I\.F|DNI|D\.N\.I|CIF|NIE|CUPS|Direcci[oó]n|Contrato|Tel[eé]fono|Email|Correo)\b.*$/i;
/** Sufijos de sociedad: el titular es una empresa. */
const COMPANY = /\b(S\.?\s?L\.?U?|S\.?\s?A\.?U?|S\.?\s?C\.?|S\.?\s?COOP|C\.?\s?B\.?|SOCIEDAD|ASOCIACI[OÓ]N|COMUNIDAD|AYUNTAMIENTO|FUNDACI[OÓ]N)\b/i;
const DIRECT_DEBIT = /domicilia|cuenta de cargo|cargo en|su cuenta|iban de pago|mandato/i;
/** Teléfonos de la comercializadora (atención, WhatsApp, averías): no son del cliente. */
const SERVICE_LINE = /atenci[oó]n|whatsapp|aver[ií]as|urgencias|servicio|gratuit|ll[aá]m|horario|contacta/i;
const MOBILE = /(?<![,.\d])(?:\+34\s?)?\b([67]\d{2})\s?(\d{3})\s?(\d{3})\b/;
const TAX_ID = /\b(?:[XYZ]-?\d{7}-?[A-Z]|\d{8}-?[A-Z]|[ABCDEFGHJNPQRSUVW]-?\d{7}-?[0-9A-J])\b/gi;

const titleCase = (value: string) =>
  value
    .toLocaleLowerCase("es-ES")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("es-ES"))
    .replace(/\b(De|Del|La|Las|Los|Y)\b/g, (word) => word.toLocaleLowerCase("es-ES"));

/** El nombre del titular tras su etiqueta, si parece un nombre. */
function holderName(lines: readonly string[]): { text: string; line: number } | null {
  for (let index = 0; index < lines.length; index++) {
    const match = HOLDER.exec(lines[index]);
    if (!match) continue;
    const value = match[1].replace(HOLDER_STOP, "").replace(/[,;:\s]+$/, "").trim();
    const words = value.split(/\s+/);
    if (/\d/.test(value) || words.length < 2 || words.length > 8 || value.length > 120) continue;
    return { text: value, line: index };
  }
  return null;
}

/**
 * El DNI o NIE del titular: los de persona se toman sin más (la
 * comercializadora es una sociedad). Un CIF solo si está en la línea del
 * titular o en la siguiente; si no, sería el de la comercializadora.
 */
function holderTaxId(lines: readonly string[], holderLine: number | null): string | null {
  const ids = (text: string) =>
    [...text.matchAll(TAX_ID)].map(([id]) => normalizeIdentifier(id)).filter(isValidSpanishTaxId);
  const personal = ids(lines.join("\n")).find((id) => /^[XYZ\d]/.test(id));
  if (personal) return personal;
  if (holderLine === null) return null;
  return ids(lines.slice(holderLine, holderLine + 2).join("\n"))[0] ?? null;
}

/** La dirección del suministro tras su etiqueta, con su código postal y población. */
function supplyAddress(lines: readonly string[]) {
  for (let index = 0; index < lines.length; index++) {
    const match = SUPPLY_ADDRESS.exec(lines[index]);
    if (!match) continue;
    // La dirección puede seguir en la línea siguiente (código postal y población).
    const text = [match[1], lines[index + 1] ?? ""].join(" ").trim();
    const postal = POSTAL_AND_CITY.exec(text);
    const street = (postal ? text.slice(0, postal.index) : match[1]).replace(/[,\s-]+$/, "").trim();
    if (!street && !postal) continue;
    return {
      address: street ? titleCase(street) : null,
      postalCode: postal?.[1] ?? null,
      city: postal?.[2] ? titleCase(postal[2].trim()) : null,
    };
  }
  return null;
}

export function clientFromInvoiceText(raw: string): StudyClientData | null {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const holder = holderName(lines);
  const documentNumber = holderTaxId(lines, holder?.line ?? null);
  const isCompany = documentNumber ? !/^[XYZ\d]/.test(documentNumber) : holder ? COMPANY.test(holder.text) : false;

  let name: string | null = null;
  let lastName: string | null = null;
  if (holder) {
    const words = titleCase(holder.text).split(/\s+/);
    if (isCompany || words.length < 2) name = holder.text;
    else {
      // En España: nombre (uno o dos) y dos apellidos al final.
      const surnames = words.length >= 3 ? 2 : 1;
      name = words.slice(0, words.length - surnames).join(" ");
      lastName = words.slice(-surnames).join(" ");
    }
  }

  const ibanLine = lines.find((line) => DIRECT_DEBIT.test(line));
  const ibanMatch = ibanLine?.match(/\b[A-Z]{2}\d{2}(?:\s?[\dA-Z]{4}){3,7}(?:\s?[\dA-Z]{1,4})?\b/);
  const iban = ibanMatch && isValidIban(ibanMatch[0]) ? ibanMatch[0].replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim() : null;
  const mobile = lines.filter((line) => !SERVICE_LINE.test(line)).map((line) => MOBILE.exec(line)).find(Boolean);
  const location = supplyAddress(lines);

  const client: StudyClientData = {
    name,
    lastName,
    kind: holder || documentNumber ? (isCompany ? "Empresa" : "Particular") : null,
    documentNumber,
    email: null,
    phone: mobile ? `${mobile[1]}${mobile[2]}${mobile[3]}` : null,
    iban,
    address: location?.address ?? null,
    postalCode: location?.postalCode ?? null,
    city: location?.city ?? null,
    province: null,
  };
  const found = Object.entries(client).some(([key, value]) => key !== "kind" && value !== null);
  return found ? client : null;
}
