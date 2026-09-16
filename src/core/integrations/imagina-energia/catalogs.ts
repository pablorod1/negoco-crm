// Enums cerrados de la API de Imagina (docs/imagina-energia/api_unificada_limpia.yml)
// y resolución tolerante desde lo que guarda el CRM: CartoCiudad devuelve los
// nombres en el idioma local ("València/Valencia", "Carrer") y los usuarios
// escriben abreviaturas o nombres antiguos ("Avda.", "Gerona").
//
// Sin dependencias de servidor: se importa también desde componentes cliente.

export const IMAGINA_PROVINCES = [
  "Albacete",
  "Alicante/Alacant",
  "Almería",
  "Araba/Álava",
  "Asturias",
  "Badajoz",
  "Balears, Illes",
  "Barcelona",
  "Bizkaia",
  "Burgos",
  "Cantabria",
  "Castellón/Castelló",
  "Ceuta",
  "Ciudad Real",
  "Coruña, A",
  "Cuenca",
  "Cáceres",
  "Cádiz",
  "Córdoba",
  "Gipuzkoa",
  "Girona",
  "Granada",
  "Guadalajara",
  "Huelva",
  "Huesca",
  "Jaén",
  "León",
  "Lleida",
  "Lugo",
  "Madrid",
  "Melilla",
  "Murcia",
  "Málaga",
  "Navarra",
  "Otro",
  "Ourense",
  "Palencia",
  "Palmas, Las",
  "Pontevedra",
  "Rioja, La",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia/València",
  "Valladolid",
  "Zamora",
  "Zaragoza",
  "Ávila",
] as const;

export const IMAGINA_ROAD_TYPES = [
  "Acceso",
  "Afueras",
  "Agrupación",
  "Alameda",
  "Aldea",
  "Arrabal",
  "Autopista / Autovía",
  "Avenida",
  "Barranco",
  "Barriada",
  "Barrio",
  "Bloque",
  "Calle",
  "Calleja",
  "Callejón",
  "Camino",
  "Carretera",
  "Carril",
  "Casa",
  "Chalet",
  "Colonia",
  "Complejo",
  "Cooperativa",
  "Cuesta",
  "Diseminado extrarradio",
  "Edificio",
  "Entrada",
  "Ficticio",
  "Finca",
  "Glorieta",
  "Grupo",
  "Lugar",
  "Manzana",
  "Masía",
  "Muelle",
  "Núcleo",
  "Otros",
  "Pantalan",
  "Paraje",
  "Parque",
  "Partida",
  "Pasaje",
  "Paseo",
  "Playa",
  "Plaza",
  "Plazoleta",
  "Poblado",
  "Políg.industrial",
  "Polígono",
  "Prolongación",
  "Rambla",
  "Residencial",
  "Ronda",
  "Senda",
  "Travesía",
  "Urbanización",
  "Vial",
  "Zona",
] as const;

export type ImaginaProvince = (typeof IMAGINA_PROVINCES)[number];
export type ImaginaRoadType = (typeof IMAGINA_ROAD_TYPES)[number];

// Clave de comparación: sin acentos, minúsculas, sin puntuación ni espacios
// repetidos. "Valencia/València" y "VALÈNCIA / VALENCIA" acaban igual.
export const catalogKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const PROVINCE_ALIASES: Record<string, ImaginaProvince> = {
  alava: "Araba/Álava",
  araba: "Araba/Álava",
  vizcaya: "Bizkaia",
  guipuzcoa: "Gipuzkoa",
  gerona: "Girona",
  lerida: "Lleida",
  orense: "Ourense",
  baleares: "Balears, Illes",
  "islas baleares": "Balears, Illes",
  "illes balears": "Balears, Illes",
  "les illes balears": "Balears, Illes",
  coruna: "Coruña, A",
  "la coruna": "Coruña, A",
  "a coruna": "Coruña, A",
  palmas: "Palmas, Las",
  "las palmas": "Palmas, Las",
  "las palmas de gran canaria": "Palmas, Las",
  rioja: "Rioja, La",
  "la rioja": "Rioja, La",
  tenerife: "Santa Cruz de Tenerife",
  "sta cruz de tenerife": "Santa Cruz de Tenerife",
  "principado de asturias": "Asturias",
  "comunidad de madrid": "Madrid",
  "region de murcia": "Murcia",
  nafarroa: "Navarra",
  "comunidad foral de navarra": "Navarra",
};

const ROAD_TYPE_ALIASES: Record<string, ImaginaRoadType> = {
  // Abreviaturas habituales en castellano
  c: "Calle",
  cl: "Calle",
  cll: "Calle",
  av: "Avenida",
  avd: "Avenida",
  avda: "Avenida",
  pz: "Plaza",
  pza: "Plaza",
  pl: "Plaza",
  ps: "Paseo",
  pso: "Paseo",
  ctra: "Carretera",
  cr: "Carretera",
  cno: "Camino",
  cmno: "Camino",
  trav: "Travesía",
  trva: "Travesía",
  urb: "Urbanización",
  gta: "Glorieta",
  pje: "Pasaje",
  rda: "Ronda",
  bo: "Barrio",
  pol: "Polígono",
  "pol ind": "Políg.industrial",
  "poligono industrial": "Políg.industrial",
  "polig industrial": "Políg.industrial",
  autovia: "Autopista / Autovía",
  autopista: "Autopista / Autovía",
  diseminado: "Diseminado extrarradio",
  plazuela: "Plazoleta",
  // Catalán / valenciano
  carrer: "Calle",
  avinguda: "Avenida",
  placa: "Plaza",
  placeta: "Plazoleta",
  passeig: "Paseo",
  cami: "Camino",
  travessera: "Travesía",
  travessia: "Travesía",
  passatge: "Pasaje",
  urbanitzacio: "Urbanización",
  poligon: "Polígono",
  "poligon industrial": "Políg.industrial",
  barri: "Barrio",
  carrero: "Callejón",
  platja: "Playa",
  via: "Vial",
  // Gallego
  rua: "Calle",
  praza: "Plaza",
  camino: "Camino",
  estrada: "Carretera",
  praia: "Playa",
  urbanizacion: "Urbanización",
  // Euskera
  kalea: "Calle",
  kale: "Calle",
  etorbidea: "Avenida",
  hiribidea: "Avenida",
  enparantza: "Plaza",
  pasealekua: "Paseo",
  bidea: "Camino",
  errepidea: "Carretera",
  zeharkalea: "Travesía",
  auzoa: "Barrio",
};

// Artículos pospuestos del INE ("Coruña, A", "Hospitalet de Llobregat, L'")
// y con qué formas antepuestas los escribe la gente.
const ARTICLE_VARIANTS: Record<string, string[]> = {
  la: ["la"],
  el: ["el"],
  los: ["los"],
  las: ["las"],
  a: ["a", "la"],
  o: ["o", "el"],
  as: ["as", "las"],
  os: ["os", "los"],
  l: ["l", "el", "la"],
  els: ["els", "los"],
  les: ["les", "las"],
  es: ["es", "el"],
  sa: ["sa", "la"],
  ses: ["ses", "las"],
};

// Formas con las que se puede escribir un valor del catálogo, ya como clave:
// "Coruña, A" → coruna a | coruna | a coruna | la coruna;
// "Alicante/Alacant" → alicante alacant | alicante | alacant | alacant alicante.
export const catalogVariants = (value: string): string[] => {
  const variants = new Set<string>([catalogKey(value)]);
  const sides = value.split("/");
  const mains: string[] = [];

  for (const side of sides) {
    variants.add(catalogKey(side));
    const withArticle = side.match(/^(.*),\s*([^,]+)$/);
    const articles = withArticle
      ? ARTICLE_VARIANTS[catalogKey(withArticle[2])]
      : undefined;
    if (withArticle && articles) {
      const main = catalogKey(withArticle[1]);
      mains.push(main);
      variants.add(main);
      for (const article of articles) variants.add(`${article} ${main}`);
    } else {
      mains.push(catalogKey(side));
    }
  }

  if (sides.length > 1) variants.add(mains.slice().reverse().join(" "));
  variants.delete("");
  return [...variants];
};

// Índice de claves → valor del enum. Prioridad: nombre exacto, alias
// curados y, por último, variantes derivadas (que nunca pisan un nombre real).
export const buildCatalogIndex = <T extends string>(
  values: readonly T[],
  aliases: Record<string, T>,
): Map<string, T> => {
  const index = new Map<string, T>();
  const add = (key: string, value: T) => {
    if (key && !index.has(key)) index.set(key, value);
  };

  for (const value of values) add(catalogKey(value), value);
  for (const [alias, value] of Object.entries(aliases)) add(alias, value);
  for (const value of values) {
    for (const variant of catalogVariants(value)) add(variant, value);
  }
  return index;
};

const PROVINCE_INDEX = buildCatalogIndex(IMAGINA_PROVINCES, PROVINCE_ALIASES);
const ROAD_TYPE_INDEX = buildCatalogIndex(IMAGINA_ROAD_TYPES, ROAD_TYPE_ALIASES);

export const resolveImaginaProvince = (
  value: string | null | undefined,
): ImaginaProvince | null =>
  value ? (PROVINCE_INDEX.get(catalogKey(value)) ?? null) : null;

export const resolveImaginaRoadType = (
  value: string | null | undefined,
): ImaginaRoadType | null =>
  value ? (ROAD_TYPE_INDEX.get(catalogKey(value)) ?? null) : null;
