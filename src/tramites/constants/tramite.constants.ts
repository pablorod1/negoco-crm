export const CLIENT_TYPES = [
  "Particular",
  "Autónomo",
  "Empresa",
  "Comunidad de Propietarios",
] as const;

export const DOCUMENT_TYPES = {
  Particular: { documentTypes: ["DNI", "NIE", "Otro"] },
  Autónomo: { documentTypes: ["DNI", "CIF", "NIE"] },
  Empresa: { documentTypes: ["CIF"] },
  "Comunidad de Propietarios": { documentTypes: ["CIF"] },
} as const;

export const CONTRACT_TYPES = [
  { label: "Cambio Compañía", value: "Cambio Compañía" },
  {
    label: "Cambio Compañía + Cambio Técnico",
    value: "Cambio Compañía + Cambio Técnico",
  },
  {
    label: "Cambio Compañía + Cambio Titular",
    value: "Cambio Compañía + Cambio Titular",
  },
  { label: "Renovación", value: "Renovación" },
  { label: "Alta Nueva", value: "Alta Nueva" },
];

export const PLAIN_CONTRACT_TYPES = [
  "Cambio Compañía",
  "Cambio Compañía + Cambio Técnico",
  "Cambio Compañía + Cambio Titular",
  "Renovación",
  "Alta Nueva",
];

export const CARGOS = ["Presidente de la Comunidad", "Administrador de Fincas"];

export const STATUS_TYPES = [
  { label: "Borrador", value: "Borrador" },
  { label: "Tramitable", value: "Tramitable" },
  { label: "Verificado", value: "Verificado" },
  { label: "Pendiente de Firma", value: "Pendiente de Firma" },
  { label: "Procesando", value: "Procesando" },
  { label: "Activo", value: "Activo" },
  { label: "Baja", value: "Baja" },
  { label: "Scoring", value: "Scoring" },
  { label: "Incidencia", value: "Incidencia" },
  { label: "KO", value: "KO" },
];

export const PLAIN_STATUS_TYPES = [
  "Borrador",
  "Tramitable",
  "Verificado",
  "Pendiente de Firma",
  "Procesando",
  "Activo",
  "Baja",
  "Scoring",
  "Incidencia",
  "KO",
];

export const COMERCIAL_STATUS_TYPES = ["Borrador", "Tramitable"];

export const PLANS = [
  "2.0TD",
  "3.0TD",
  "6.1TD",
  "1TD",
  "RL-1",
  "RL-2",
  "RL-3",
  "RL-4",
  "RL-5",
  "RL-6",
  "RL-7",
];

export const POTS = [
  "Pot. 1",
  "Pot. 2",
  "Pot. 3",
  "Pot. 4",
  "Pot. 5",
  "Pot. 6",
];

export const COMPANIES = [
  { label: "Acciona", value: "Acciona" },
  { label: "Aletteo", value: "Aletteo" },
  { label: "APOLO", value: "APOLO" },
  { label: "Audax", value: "Audax" },
  { label: "Chc", value: "Chc" },
  { label: "Eleia", value: "Eleia" },
  { label: "Endesa", value: "Endesa" },
  { label: "Gana Energía", value: "Gana Energía" },
  { label: "Iberdrola", value: "Iberdrola" },
  { label: "Ignis", value: "Ignis" },
  { label: "Logos", value: "Logos" },
  { label: "Naturgy", value: "Naturgy" },
  { label: "Octopus", value: "Octopus" },
  { label: "Repsol", value: "Repsol" },
  { label: "Totalenergies", value: "Totalenergies" },
  { label: "UniElectrica", value: "UniElectrica" },
  { label: "VM", value: "VM" },
  { label: "YaLuz", value: "YaLuz" },
  { label: "Zima Energia", value: "Zima Energia" },
  { label: "Otra", value: "Otra" },
];

export const PLAIN_COMPANIES = [
  "Acciona",
  "Aletteo",
  "APOLO",
  "Audax",
  "Chc",
  "Eleia",
  "Endesa",
  "Gana Energía",
  "Iberdrola",
  "Ignis",
  "Logos",
  "Naturgy",
  "Octopus",
  "Repsol",
  "Totalenergies",
  "UniElectrica",
  "VM",
  "YaLuz",
  "Zima Energia",
  "Otra",
];

export const LIQUIDEZ_STATUS = [
  { label: "Pendiente de Cobro", value: "Pendiente de Cobro" },
  {
    label: "Cobrado por Comercializadora",
    value: "Cobrado por Comercializadora",
  },
  { label: "Pagado al Comercial", value: "Pagado al Comercial" },
  { label: "Pendiente de Descontar", value: "Pendiente de Descontar" },
  { label: "Descontado", value: "Descontado" },
];

export const PLAIN_LIQUIDEZ_STATUS = [
  "Pendiente de Cobro",
  "Cobrado por Comercializadora",
  "Pagado al Comercial",
];

export const BAJA_LIQUIDEZ_STATUS = ["Pendiente de Descontar", "Descontado"];
