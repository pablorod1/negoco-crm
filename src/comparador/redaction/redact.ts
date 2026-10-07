import {
  isValidCups,
  isValidSpanishTaxId,
  normalizeIdentifier,
} from "@/comparador/extraction/identifiers";

/**
 * Anonimizado local del texto de una factura, sin IA. Deja solo lo que sirve
 * para el cálculo (líneas con cifras o conceptos de factura) y tapa todo lo
 * que identifica a una persona. Lo que no se puede tapar con seguridad se
 * descarta, y lo que se queda dudoso se marca para que lo mire una persona.
 */

const PATTERNS = {
  cups: /\bES\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?[A-Z]{2}(?:\s?\d[A-Z])?\b/gi,
  iban: /\b[A-Z]{2}\d{2}(?:\s?[\dA-Z*]{4}){3,7}(?:\s?[\dA-Z*]{1,4})?\b/g,
  // IBAN ya enmascarado por la comercializadora: ES*******************154.
  maskedIban: /\b[A-Z]{2}[\d*]{2}[\d*\s]{8,}\d{0,4}\b/g,
  // Códigos alfanuméricos largos: mandatos SEPA, cuentas, contratos.
  code: /\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9][A-Z0-9-]{7,}\b/g,
  taxId:
    /\b(?:[XYZ]-?\d{7}-?[A-Z]|\d{8}-?[A-Z]|[ABCDEFGHJNPQRSUVW]-?\d{7}-?[0-9A-J])\b/gi,
  email: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
  // Ni teléfonos ni números largos tras una coma o un punto: son decimales
  // (por ejemplo el tipo del IEE, 5,11269632 %).
  phone:
    /(?<![,.\d])(?:\+34\s?)?\b[6789]\d{2}(?:\s?\d{3}\s?\d{3}|\s\d{2}\s\d{2}\s\d{2})\b/g,
  longNumber: /(?<![,.\d])\b\d{8,}\b/g,
} as const;

export type IdentifierKind = keyof typeof PATTERNS;

const PLACEHOLDERS: Record<IdentifierKind, string> = {
  cups: "[CUPS]",
  iban: "[IBAN]",
  maskedIban: "[IBAN]",
  code: "[CODIGO]",
  taxId: "[NIF]",
  email: "[EMAIL]",
  phone: "[TELEFONO]",
  longNumber: "[NUMERO]",
};

/** Conceptos que hacen útil una línea aunque no tenga cifras. */
const INVOICE_KEYWORDS =
  /\b(potencia|energ[ií]a|consumo|peajes?|cargos?|bono social|financiaci[oó]n|impuestos?|iva|iee|alquiler|equipos?|contador|total|importe|periodo|per[ií]odo|descuentos?|bonificaci[oó]n|servicios?|base imponible|subtotal|fecha|d[ií]as|punta|llano|valle|tarifa|factura|otros|conceptos|regulados?|excesos?|reactiva|mecanismo|ajuste|compensaci[oó]n|excedentes|autoconsumo|cuota|suplemento|recargo|tasa|margen|gesti[oó]n|mantenimiento|seguro|asistencia|pack|kwh?|€|eur)\b/i;

/** Líneas de dirección: se descartan enteras. */
const ADDRESS_LINE =
  /(\b(calle|cl|c\/|avda\.?|avenida|av\.|plaza|pza\.?|paseo|ps\.|camino|carretera|ctra\.?|urbanizaci[oó]n|urb\.|pol[ií]gono|ronda|traves[ií]a|partida|barrio|direcci[oó]n|domicilio|c\.p\.|c[oó]digo postal|piso|pta\.?|puerta|esc\.|escalera|portal|bloque)\b)|c\//i;

/** Código postal seguido de localidad, sin importes: es una dirección. */
const POSTAL_CODE_LINE = /\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}[,\s]+\p{Lu}/u;
// Unidades como palabra completa: una población acabada en «DIA» no es «día».
const HAS_INVOICE_UNITS = /€|%|\b(eur|kwh?|kvarh|d[ií]as?)\b/i;
const HAS_DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{1,2} de [a-z]+ de \d{4}\b/i;
const HAS_PERIOD = /\bP[1-6]\b|\b\d\.\d\s?TD\b/i;
const ONLY_NUMBERS = /^[\d.,\s()+\-=×x*/R]+$/;

/**
 * Saludos con el nombre del cliente: «CONCHA, tienes 5 €», «Hola Juan»,
 * «Estimada María». Se descartan enteros.
 */
const GREETING_LINE =
  /^\s*\p{Lu}[\p{L}'-]{2,}(?:\s+\p{Lu}[\p{L}'-]{2,})?\s*,|\b(hola|estimad[oa]|querid[oa])\b/iu;

/** Etiquetas tras las que suele venir el nombre del titular. */
const HOLDER_LABEL =
  /\b(titular(?: del contrato)?|nombre(?: y apellidos)?|raz[oó]n social|cliente)\s*[:\-]\s*(.+)$/i;

/** Palabras en mayúsculas que no son nombres de persona. */
const ALLOWED_CAPITALIZED = new Set(
  `TOTAL IMPORTE FACTURA IVA IEE BASE IMPONIBLE ENERGIA ENERGÍA POTENCIA CONSUMO PEAJE PEAJES CARGOS BONO SOCIAL ALQUILER EQUIPOS CONTADOR SERVICIOS OTROS CONCEPTOS DETALLE DESCUENTO PUNTA LLANO VALLE KWH KW EUR TD DE DEL LA EL LOS LAS Y A EN POR PARA CON SIN SU SUS TU TUS AL PACK HOGAR ELECTRICIDAD LUZ GAS RESUMEN FECHA PERIODO PERÍODO CUPS NIF IBAN SA SAU SL SLU NATURGY IBERDROLA ENDESA REPSOL TOTALENERGIES PLENITUDE ENI GANA HOLALUZ OCTOPUS AUDAX AXPO APOLO IMAGINA ELEIA NEXUS FACTOR LUCERA PODO CLIENTES IBERIA ENERGIA ENERGÍA COMERCIALIZADORA MERCADO LIBRE REGULADO TARIFA CNMC BOE`.split(
    /\s+/,
  ),
);

export interface RedactionResult {
  text: string;
  /** Identificadores encontrados, solo para uso local; nunca se envían. */
  identifiers: Record<IdentifierKind, string[]>;
  holderTokens: string[];
  keptLines: number;
  droppedLines: number;
  /** Restos con forma de dato personal: si hay alguno, no se envía. */
  leaks: string[];
  /** Mayúsculas seguidas que podrían ser un nombre; las revisa una persona. */
  suspiciousLines: number;
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHolderTokens(lines: readonly string[]): string[] {
  const tokens = new Set<string>();
  for (const line of lines) {
    const match = HOLDER_LABEL.exec(line);
    if (!match) continue;
    for (const token of match[2].split(/[\s,;]+/)) {
      const clean = token.replace(/[^\p{L}'-]/gu, "");
      if (clean.length < 3) continue;
      if (ALLOWED_CAPITALIZED.has(stripAccents(clean).toUpperCase())) continue;
      tokens.add(clean);
    }
  }
  return [...tokens];
}

function looksLikeName(line: string): boolean {
  const words = line.match(/\b[\p{Lu}][\p{Lu}'-]{2,}\b/gu) ?? [];
  let streak = 0;
  for (const word of words) {
    streak = ALLOWED_CAPITALIZED.has(stripAccents(word)) ? 0 : streak + 1;
    if (streak >= 2) return true;
  }
  return false;
}

export function findLeaks(text: string): string[] {
  const leaks: string[] = (Object.keys(PATTERNS) as IdentifierKind[]).filter(
    (kind) => new RegExp(PATTERNS[kind].source, PATTERNS[kind].flags).test(text),
  );
  const hasAddress = text
    .split("\n")
    .some(
      (line) =>
        ADDRESS_LINE.test(line) ||
        (POSTAL_CODE_LINE.test(line) && !HAS_INVOICE_UNITS.test(line)),
    );
  if (hasAddress) leaks.push("address");
  return leaks;
}

export function redactInvoiceText(raw: string): RedactionResult {
  const lines = raw.split(/\r?\n/);
  const identifiers = Object.fromEntries(
    (Object.keys(PATTERNS) as IdentifierKind[]).map((kind) => [kind, [] as string[]]),
  ) as Record<IdentifierKind, string[]>;

  for (const kind of Object.keys(PATTERNS) as IdentifierKind[]) {
    for (const match of raw.matchAll(new RegExp(PATTERNS[kind].source, PATTERNS[kind].flags))) {
      identifiers[kind].push(match[0]);
    }
  }
  identifiers.cups = [...new Set(identifiers.cups.map(normalizeIdentifier))].filter(isValidCups);
  identifiers.taxId = [...new Set(identifiers.taxId.map(normalizeIdentifier))].filter(
    isValidSpanishTaxId,
  );

  const holderTokens = findHolderTokens(lines);
  const holderPattern = holderTokens.length
    ? new RegExp(`\\b(${holderTokens.map(escapeRegExp).join("|")})\\b`, "giu")
    : null;

  const kept: string[] = [];
  let droppedLines = 0;
  let suspiciousLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Útil: conceptos de factura, unidades, fechas, periodos o solo cifras.
    // Una línea con letras y cifras pero sin nada de eso (un portal y una
    // puerta, un código de cuenta) se descarta.
    const useful =
      INVOICE_KEYWORDS.test(trimmed) ||
      HAS_INVOICE_UNITS.test(trimmed) ||
      HAS_DATE.test(trimmed) ||
      HAS_PERIOD.test(trimmed) ||
      ONLY_NUMBERS.test(trimmed);
    const isAddress =
      ADDRESS_LINE.test(trimmed) ||
      (POSTAL_CODE_LINE.test(trimmed) && !HAS_INVOICE_UNITS.test(trimmed));
    if (
      !useful ||
      isAddress ||
      HOLDER_LABEL.test(trimmed) ||
      GREETING_LINE.test(trimmed)
    ) {
      droppedLines += 1;
      continue;
    }

    // El orden importa: primero los patrones más específicos.
    let redacted = trimmed;
    for (const kind of [
      "cups",
      "iban",
      "maskedIban",
      "email",
      "taxId",
      "code",
      "phone",
      "longNumber",
    ] as const) {
      redacted = redacted.replace(
        new RegExp(PATTERNS[kind].source, PATTERNS[kind].flags),
        PLACEHOLDERS[kind],
      );
    }
    if (holderPattern) redacted = redacted.replace(holderPattern, "[TITULAR]");
    if (looksLikeName(redacted)) suspiciousLines += 1;
    kept.push(redacted);
  }

  const text = kept.join("\n");
  const leaks = findLeaks(text);
  if (holderPattern && new RegExp(holderPattern.source, "iu").test(text)) {
    leaks.push("holder");
  }

  return {
    text,
    identifiers,
    holderTokens,
    keptLines: kept.length,
    droppedLines,
    leaks,
    suspiciousLines,
  };
}
