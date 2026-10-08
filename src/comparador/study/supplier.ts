import { nameTokens } from "@/comparador/engine/commission";

/** Palabras que, detrás del nombre, indican la distribuidora y no la comercializadora. */
const DISTRIBUTION = new Set(["distribucion", "distribuidora", "redes", "electrica"]);

/** Formas jurídicas que no forman parte del nombre comercial. */
const LEGAL_FORMS = new Set(["sa", "sl", "slu", "sau", "s", "a", "l", "u"]);

function phraseAt(haystack: readonly string[], needle: readonly string[]): number[] {
  const starts: number[] = [];
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) starts.push(start);
  }
  return starts;
}

/**
 * La comercializadora de la factura cuando la IA no la da: la única del
 * tenant cuyo nombre aparece en el texto (Eleia solo se nombra en el pie, «Eleia
 * Energía está adherida…», porque la cabecera es un logo). No cuenta una
 * mención seguida de «distribución»: «Iberdrola Distribución» no es la
 * comercializadora. Si aparecen varias, no se adivina.
 */
export function detectSupplierInText(
  text: string,
  suppliers: readonly { id: string; name: string }[],
): { id: string; name: string } | null {
  const words = nameTokens(text);
  const found = suppliers.filter(({ name }) => {
    const needle = nameTokens(name).filter((token) => !LEGAL_FORMS.has(token));
    if (needle.length === 0 || (needle.length === 1 && needle[0].length < 4)) return false;
    return phraseAt(words, needle).some((start) => !DISTRIBUTION.has(words[start + needle.length] ?? ""));
  });
  return found.length === 1 ? found[0] : null;
}
