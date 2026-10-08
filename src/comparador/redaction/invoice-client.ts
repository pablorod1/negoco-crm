import { isValidSpanishTaxId, normalizeIdentifier } from "@/comparador/extraction/identifiers";
import { isValidIban, type StudyClientData } from "@/comparador/study/client-data";
import { ALLOWED_CAPITALIZED } from "./redact";

/**
 * Datos del titular leídos en local del texto de la factura, sin IA: rellenan
 * de antemano los datos del cliente del estudio (y con ellos el trámite).
 * Nunca se envían fuera del CRM. Se toma lo que la factura dice con su
 * etiqueta o en el bloque de la dirección postal del titular (nombre, calle,
 * NIF): ante la duda, el campo se queda vacío y lo escribe una persona.
 */

const HOLDER = /\b(?:titular(?: del contrato| del suministro)?|nombre(?: y apellidos)?|raz[oó]n social)\s*[:\-]\s*(.+)$/i;
const SUPPLY_ADDRESS = /\bdirecci[oó]n (?:del |de )?(?:suministro|punto de suministro)\s*[:\-]?\s*(.*)$/i;
const POSTAL_AND_CITY = /\b((?:0[1-9]|[1-4]\d|5[0-2])\d{3})\b[\s,-]*([\p{L}][\p{L}' .-]*[\p{L}])?/u;
/** Lo que corta el nombre del titular: otra etiqueta en la misma línea («CNAE: 9820»). */
const HOLDER_STOP = /\s{2,}|\t|\s+(?:NIF|N\.I\.F|DNI|D\.N\.I|CIF|NIE|CUPS|Direcci[oó]n|Contrato|Tel[eé]fono|Email|Correo)\b.*$|\s+[\p{L}.]+\s*:.*$/iu;
/** Sufijos de sociedad: el titular es una empresa. */
const COMPANY = /\b(S\.?\s?L\.?U?|S\.?\s?A\.?U?|S\.?\s?C\.?|S\.?\s?COOP|C\.?\s?B\.?|SOCIEDAD|ASOCIACI[OÓ]N|COMUNIDAD|AYUNTAMIENTO|FUNDACI[OÓ]N)\b/i;
const DIRECT_DEBIT = /domicilia|cuenta de cargo|cargo en|su cuenta|iban de pago|mandato/i;
/** Teléfonos de la comercializadora (atención, WhatsApp, averías): no son del cliente. */
const SERVICE_LINE = /atenci[oó]n|whatsapp|aver[ií]as|urgencias|servicio|gratuit|ll[aá]m|horario|contacta/i;
const MOBILE = /(?<![,.\d])(?:\+34\s?)?\b([67]\d{2})\s?(\d{3})\s?(\d{3})\b/;
/** Una línea solo de palabras en mayúsculas, de 2 a 6: un nombre en el bloque postal. */
const UPPERCASE_NAME = /^\p{Lu}[\p{Lu}'.-]*(?:\s+\p{Lu}[\p{Lu}'.-]*){1,5}$/u;
/**
 * Una línea de la dirección postal: empieza por el tipo de vía o es el código
 * postal con la población. Una línea cualquiera con cifras (un importe) no lo es.
 */
const ADDRESS_LIKE = /^(?:C\/|CL|CALLE|AV|AVDA|AVENIDA|PZ|PZA|PLAZA|PS|PASEO|CTRA|CARRETERA|CM|CAMINO|RD|RONDA|TR|TRAVESIA|URB|POL|EDIFICIO|BLOQUE|PORTAL)\b|^(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b|\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\s*,?\s*\p{L}+/iu;
const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** Una línea en mayúsculas con palabras de factura («TOTAL IMPORTE FACTURA») no es un nombre. */
const isInvoiceWording = (line: string) =>
  line
    .split(/\s+/)
    .map((word) => stripAccents(word.replace(/[^\p{L}]/gu, "")).toUpperCase())
    // Los sufijos de sociedad sí van en el nombre de una empresa.
    .some((word) => !/^(SA|SAU|SL|SLU)$/.test(word) && ALLOWED_CAPITALIZED.has(word));
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
    if (/\d/.test(value) || words.length < 2 || words.length > 8 || value.length > 120 || isInvoiceWording(value)) continue;
    return { text: value, line: index };
  }
  return null;
}

/**
 * Sin etiqueta, el titular está en el bloque de la dirección postal: el nombre
 * en mayúsculas encima de la calle, y el NIF debajo. Se busca hacia arriba
 * desde la línea del DNI o NIE, saltando las de la dirección.
 */
function holderFromPostalBlock(lines: readonly string[], taxId: string | null): { text: string; line: number } | null {
  if (!taxId || !/^[XYZ\d]/.test(taxId)) return null;
  const idLine = lines.findIndex((line) => normalizeIdentifier(line).includes(taxId));
  if (idLine < 0) return null;
  let found: { text: string; line: number } | null = null;
  for (let index = idLine - 1; index >= Math.max(0, idLine - 6); index--) {
    const line = lines[index];
    if (UPPERCASE_NAME.test(line) && !COMPANY.test(line) && !isInvoiceWording(line)) found = { text: line, line: index };
    else if (found || !ADDRESS_LIKE.test(line)) break;
  }
  return found;
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
    // La etiqueta puede ir sola en su línea, con la dirección debajo; y el
    // código postal y la población, en la línea siguiente.
    const sameLine = match[1].trim();
    const next = lines[index + 1] ?? "";
    const text = !sameLine ? next : POSTAL_AND_CITY.test(sameLine) || !POSTAL_AND_CITY.test(next) ? sameLine : `${sameLine} ${next}`;
    if (!text || /\b(potencia|consumo|cups|tarifa)\b/i.test(text)) continue;
    const postal = POSTAL_AND_CITY.exec(text);
    let street = (postal ? text.slice(0, postal.index) : text).replace(/[,\s-]+$/, "").trim();
    let city = postal?.[2]?.trim() ?? null;
    // «CL MAYOR 5 - MADRID»: la población tras el guion.
    const dash = /^(.*\d.*?)\s+-\s+(\p{L}[\p{L}' .]*)$/u.exec(street);
    if (!city && dash) [street, city] = [dash[1], dash[2]];
    if (!street && !postal) continue;
    return {
      address: street ? titleCase(street) : null,
      postalCode: postal?.[1] ?? null,
      city: city ? titleCase(city) : null,
    };
  }
  return null;
}

export function clientFromInvoiceText(raw: string): StudyClientData | null {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const labelled = holderName(lines);
  const documentNumber = holderTaxId(lines, labelled?.line ?? null);
  const holder = labelled ?? holderFromPostalBlock(lines, documentNumber);
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
  // Un número de la comercializadora puede ir en la línea siguiente a su texto.
  const mobile = lines
    .filter((line, index) => !SERVICE_LINE.test(line) && !SERVICE_LINE.test(lines[index - 1] ?? "") && !/contrato de suministro/i.test(lines[index - 1] ?? ""))
    .map((line) => MOBILE.exec(line))
    .find(Boolean);
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
