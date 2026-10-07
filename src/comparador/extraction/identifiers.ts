const CONTROL_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizeIdentifier(value: string): string {
  return value.replace(/[\s.\-_]/g, "").toUpperCase();
}

/**
 * CUPS: ES + 16 dígitos + 2 letras de control (+ 0–2 caracteres de punto
 * frontera). Las letras salen del número módulo 529.
 */
export function isValidCups(raw: string): boolean {
  const cups = normalizeIdentifier(raw);
  const match = /^ES(\d{16})([A-Z]{2})([0-9][A-Z])?$/.exec(cups);
  if (!match) return false;

  const remainder = Number(BigInt(match[1]) % BigInt(529));
  const expected =
    CONTROL_LETTERS[Math.floor(remainder / 23)] + CONTROL_LETTERS[remainder % 23];
  return match[2] === expected;
}

function isValidDniOrNie(id: string): boolean {
  const match = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(id);
  if (!match) return false;

  const [, niePrefix, digits, letter] = match;
  if (niePrefix && digits.length !== 7) return false;
  if (!niePrefix && digits.length !== 8) return false;

  const number = Number(`${niePrefix ? "XYZ".indexOf(niePrefix) : ""}${digits}`);
  return CONTROL_LETTERS[number % 23] === letter;
}

function isValidCif(id: string): boolean {
  const match = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(id);
  if (!match) return false;

  const [, entity, body, control] = match;
  const digits = body.split("").map(Number);
  let sum = digits[1] + digits[3] + digits[5];
  for (const index of [0, 2, 4, 6]) {
    const doubled = digits[index] * 2;
    sum += Math.floor(doubled / 10) + (doubled % 10);
  }
  const controlDigit = (10 - (sum % 10)) % 10;
  const controlLetter = "JABCDEFGHI"[controlDigit];

  // Unas entidades llevan siempre letra de control, otras siempre número.
  if ("PQRSNW".includes(entity)) return control === controlLetter;
  if ("ABEH".includes(entity)) return control === String(controlDigit);
  return control === String(controlDigit) || control === controlLetter;
}

/** DNI, NIE o CIF español con su control correcto. */
export function isValidSpanishTaxId(raw: string): boolean {
  const id = normalizeIdentifier(raw);
  return isValidDniOrNie(id) || isValidCif(id);
}
