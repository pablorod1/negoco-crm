// Traduce los errores de validación del payload de Imagina (mappers.ts) a
// algo que el usuario pueda leer y corregir desde el CRM.

export interface ImaginaMissingField {
  field?: string;
  source?: string;
  message?: string;
}

export interface ImaginaMissingGroup {
  source: string;
  label: string;
  items: Array<{ field: string; label: string; message: string }>;
}

const SOURCE_LABELS: Record<string, string> = {
  clients: "Cliente",
  contracts: "Contrato",
  signers: "Firmante",
  comercializadora_rates: "Tarifa",
};

const SOURCE_ORDER = ["clients", "signers", "contracts", "comercializadora_rates"];

// Nombre del campo en la API de Imagina → etiqueta del CRM.
const FIELD_LABELS: Record<string, string> = {
  cups: "CUPS",
  provincia: "Provincia del suministro",
  municipio: "Municipio del suministro",
  cod_postal: "Código postal del suministro",
  tipo_via_cnmc: "Tipo de vía (CNMC) del suministro",
  calle: "Calle del suministro",
  numero_finca: "Número de finca del suministro",
  potencia_contratada: "Potencias contratadas (P1..P6)",
  canal_envio: "Canal de firma",
  id_tarifa: "Tarifa de Imagina Energía",
  iban: "IBAN",
  telefono_titular: "Teléfono del titular",
  email_titular: "Email del titular",
  provincia_titular: "Provincia del titular",
  municipio_titular: "Municipio del titular",
  cod_postal_titular: "Código postal del titular",
  tipo_via_titular_cnmc: "Tipo de vía (CNMC) del titular",
  calle_titular: "Calle del titular",
  numero_finca_titular: "Número de finca del titular",
  tipo_documento_titular: "Tipo de documento del titular",
  numero_documento_titular: "Número de documento del titular",
  nombre_titular: "Nombre del titular",
  primer_apellido_titular: "Apellidos del titular",
  razon_social_titular: "Razón social",
  id_cnae: "CNAE",
  firmante: "Firmante",
  nombre_firmante: "Nombre del firmante",
  primer_apellido_firmante: "Apellido del firmante",
  tipo_documento_firmante: "Tipo de documento del firmante",
  numero_documento_firmante: "Número de documento del firmante",
};

export const getImaginaFieldLabel = (field?: string): string =>
  (field && FIELD_LABELS[field]) || field || "Campo desconocido";

export const getImaginaSourceLabel = (source?: string): string =>
  (source && SOURCE_LABELS[source]) || "Otros datos";

export const groupImaginaMissingFields = (
  missing?: ImaginaMissingField[] | null,
): ImaginaMissingGroup[] => {
  if (!missing?.length) return [];

  const groups = new Map<string, ImaginaMissingGroup>();
  for (const item of missing) {
    const source = item.source || "other";
    let group = groups.get(source);
    if (!group) {
      group = {
        source,
        label: getImaginaSourceLabel(item.source),
        items: [],
      };
      groups.set(source, group);
    }
    group.items.push({
      field: item.field || "",
      label: getImaginaFieldLabel(item.field),
      message: item.message || "",
    });
  }

  return [...groups.values()].sort((a, b) => {
    const ia = SOURCE_ORDER.indexOf(a.source);
    const ib = SOURCE_ORDER.indexOf(b.source);
    return (ia === -1 ? SOURCE_ORDER.length : ia) - (ib === -1 ? SOURCE_ORDER.length : ib);
  });
};

// Resumen de una línea por campo, para toasts.
export const formatImaginaMissing = (
  missing?: ImaginaMissingField[] | null,
): string | undefined =>
  missing
    ?.map((item) =>
      [getImaginaSourceLabel(item.source), getImaginaFieldLabel(item.field)]
        .filter(Boolean)
        .join(" · "),
    )
    .join("\n") || undefined;

export interface ImaginaReadinessProgress {
  total: number;
  completed: number;
  percent: number;
}

// Progreso = campos requeridos que no aparecen en `missing`.
export const computeImaginaProgress = (
  required: string[],
  missing?: ImaginaMissingField[] | null,
): ImaginaReadinessProgress => {
  const missingFields = new Set(
    (missing ?? []).map((item) => item.field).filter(Boolean),
  );
  const total = required.length;
  const completed = required.filter((field) => !missingFields.has(field)).length;
  return {
    total,
    completed,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
  };
};
