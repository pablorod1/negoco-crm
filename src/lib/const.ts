export const CLIENT_TYPES = [
  "Particular",
  "Autónomo",
  "Empresa",
  "Cominidad de Propietarios",
];

export const DOCUMENT_TYPES = {
  Particular: { documentTypes: ["DNI", "NIE", "Otro"] },
  Autónomo: { documentTypes: ["DNI", "CIF"] },
  Empresa: { documentTypes: ["CIF"] },
  "Comunidad de Propietarios": { documentTypes: ["CIF"] },
};

export const CONTRACT_TYPES = [
  "Cambio Compañía",
  "Cambio Compañía + Cambio Técnico",
  "Cambio Compañía + Cambio Titular",
];

export const CARGOS = ["Presidente de la Comunidad", "Administrador de Fincas"];

export const STATUS_TYPES = [
  "Borrador",
  "Tramitable",
  "Verificado",
  "Pendiente de Firma",
  "Procesando",
  "Activo",
  "Baja",
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
export const ACTIVATION_DATE = new Date();
export const RENOVATION_DATE = new Date(
  ACTIVATION_DATE.getTime() + 31536000000
);

export const COMPANIES = [
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
  "Pendiente de Cobro",
  "Cobrado por Comercializadora",
  "Pagado al comercial",
];
