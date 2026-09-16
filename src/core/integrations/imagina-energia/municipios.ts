// Catálogo de municipios de Imagina (8.116 nombres INE). El índice se
// construye en la primera consulta; los componentes cliente importan este
// módulo de forma dinámica para no cargar el catálogo hasta necesitarlo.
import { buildCatalogIndex, catalogKey, catalogVariants } from "./catalogs";
import { IMAGINA_MUNICIPIOS } from "./municipios.data";

export { IMAGINA_MUNICIPIOS };

// Nombres castellanos o coloquiales que el INE no recoge como variante.
const MUNICIPIO_ALIASES: Record<string, string> = {
  vitoria: "Vitoria-Gasteiz",
  gasteiz: "Vitoria-Gasteiz",
  castellon: "Castellón de la Plana/Castelló de la Plana",
  castello: "Castellón de la Plana/Castelló de la Plana",
  villarreal: "Vila-real",
  "palma de mallorca": "Palma",
  mahon: "Maó-Mahón",
  mao: "Maó-Mahón",
  ibiza: "Eivissa",
  orense: "Ourense",
  gerona: "Girona",
  lerida: "Lleida",
  "las palmas": "Palmas de Gran Canaria, Las",
  "san sebastian": "Donostia/San Sebastián",
  pamplona: "Pamplona/Iruña",
  "santa cruz": "Santa Cruz de Tenerife",
};

let index: Map<string, string> | null = null;
let searchable: Array<{ name: string; variants: string[] }> | null = null;

const getIndex = () =>
  (index ??= buildCatalogIndex(IMAGINA_MUNICIPIOS, MUNICIPIO_ALIASES));

const getSearchable = () =>
  (searchable ??= IMAGINA_MUNICIPIOS.map((name) => ({
    name,
    variants: catalogVariants(name),
  })));

export const resolveImaginaMunicipio = (
  value: string | null | undefined,
): string | null =>
  value ? (getIndex().get(catalogKey(value)) ?? null) : null;

// Sugerencias para el combobox: exacto, luego por prefijo, luego contiene.
export const searchImaginaMunicipios = (
  query: string,
  limit = 20,
): string[] => {
  const key = catalogKey(query);
  if (!key) return [];

  const exact = getIndex().get(key);
  const prefix: string[] = [];
  const contains: string[] = [];

  for (const entry of getSearchable()) {
    if (entry.name === exact) continue;
    if (entry.variants.some((variant) => variant.startsWith(key))) {
      prefix.push(entry.name);
    } else if (
      contains.length + prefix.length < limit &&
      entry.variants.some((variant) => variant.includes(key))
    ) {
      contains.push(entry.name);
    }
    if (prefix.length >= limit) break;
  }

  return [...(exact ? [exact] : []), ...prefix, ...contains].slice(0, limit);
};
