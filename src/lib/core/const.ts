export const CLIENT_TYPES = [
  "Particular",
  "Autónomo",
  "Empresa",
  "Comunidad de Propietarios",
];

export const DOCUMENT_TYPES = {
  Particular: { documentTypes: ["DNI", "NIE", "Otro"] },
  Autónomo: { documentTypes: ["DNI", "CIF", "NIE"] },
  Empresa: { documentTypes: ["CIF"] },
  "Comunidad de Propietarios": { documentTypes: ["CIF"] },
};

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
];

export const PLAIN_CONTRACT_TYPES = [
  "Cambio Compañía",
  "Cambio Compañía + Cambio Técnico",
  "Cambio Compañía + Cambio Titular",
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
];

export const COMPARATIVA_STATUS_TYPES = [
  { value: "pending", label: "Pendiente de Estudio" },
  { value: "completed", label: "Estudio Realizado" },
  { value: "processed", label: "Completada" },
  { value: "rejected", label: "Rechazada" },
];

export const PLAIN_COMPARATIVA_STATUS_TYPES = [
  "pending",
  "completed",
  "processed",
  "rejected",
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

export const NOW_DATE = new Date();
export const RENOVATION_DATE = new Date(NOW_DATE.getTime() + 31536000000);

export const COMPANIES = [
  { label: "Eleia", value: "Eleia" },
  { label: "Acciona", value: "Acciona" },
  { label: "Logos", value: "Logos" },
  { label: "Endesa", value: "Endesa" },
  { label: "Audax", value: "Audax" },
  { label: "YaLuz", value: "YaLuz" },
  {
    label: "Gana Energía",
    value: "Gana Energía",
  },
  { label: "Naturgy", value: "Naturgy" },
  { label: "Iberdrola", value: "Iberdrola" },
  {
    label: "Totalenergies",
    value: "Totalenergies",
  },
  { label: "Ignis", value: "Ignis" },
  { label: "Repsol", value: "Repsol" },
  { label: "UniElectrica", value: "UniElectrica" },
  { label: "Zima Energia", value: "Zima Energia" },
];

export const PLAIN_COMPANIES = [
  "Eleia",
  "Acciona",
  "Logos",
  "Endesa",
  "Audax",
  "YaLuz",
  "Gana Energía",
  "Naturgy",
  "Iberdrola",
  "Totalenergies",
  "Ignis",
  "Repsol",
  "UniElectrica",
  "Zima Energia",
];

export const LIQUIDEZ_STATUS = [
  { label: "Pendiente de Cobro", value: "Pendiente de Cobro" },
  {
    label: "Cobrado por Comercializadora",
    value: "Cobrado por Comercializadora",
  },
  { label: "Pagado al Comercial", value: "Pagado al Comercial" },
];

export const PLAIN_LIQUIDEZ_STATUS = [
  "Pendiente de Cobro",
  "Cobrado por Comercializadora",
  "Pagado al Comercial",
];

export const BAJA_LIQUIDEZ_STATUS = ["Pendiente de Descontar", "Descontado"];

export const ROLES = ["Dirección", "Backoffice", "Comercial"];

export const SELECT_ROLES = [
  { label: "Dirección", value: "admin" },
  { label: "Backoffice", value: "1" },
  { label: "Comercial", value: "2" },
];
