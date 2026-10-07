/** Comercializadoras que se reconocen en el texto de una factura. */
const SUPPLIERS: readonly [string, RegExp][] = [
  ["Endesa", /\bendesa\b/gi],
  ["Energía XXI", /energ[ií]a\s+xxi/gi],
  ["Iberdrola", /\biberdrola\b/gi],
  ["Curenergía", /curenerg[ií]a/gi],
  ["Naturgy", /\bnaturgy\b/gi],
  ["Plenitude", /\bplenitude\b/gi],
  ["TotalEnergies", /total\s?energies/gi],
  ["Repsol", /\brepsol\b/gi],
  ["Gana Energía", /gana\s+energ[ií]a/gi],
  ["Holaluz", /\bholaluz\b/gi],
  ["Octopus", /\boctopus\b/gi],
  ["Audax", /\baudax\b/gi],
  ["Imagina Energía", /imagina\s+energ[ií]a/gi],
  ["Axpo", /\baxpo\b/gi],
  ["Eleia", /\beleia\b/gi],
  ["Apolo", /\bapolo\b/gi],
  ["Nexus", /nexus\s+energ[ií]a/gi],
  ["Factor Energía", /factor\s+energ[ií]a/gi],
  ["Lucera", /\blucera\b/gi],
  ["EDP", /\bedp\b/gi],
  ["Aldro", /\baldro\b/gi],
  ["Fenie", /\bfenie\b/gi],
];

/** La comercializadora que más veces aparece en el texto. */
export function detectSupplier(text: string): string {
  let best = { name: "otra", hits: 0 };
  for (const [name, pattern] of SUPPLIERS) {
    const hits = text.match(pattern)?.length ?? 0;
    if (hits > best.hits) best = { name, hits };
  }
  return best.name;
}
