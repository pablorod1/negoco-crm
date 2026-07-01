import type {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
} from "@/tramites/types/tramite.types";
import {
  isCUPSWellFormed,
  isEmailWellFormed,
  isIBANWellFormed,
  isPhoneNumberWellFormed,
} from "@/core/validation/plane-validation";
import {
  buildTenantWebhookUrl,
  IMAGINA_SUPPLIER_NAME,
} from "./config";

export interface ImaginaValidationError {
  field: string;
  source: string;
  message: string;
}

export interface ImaginaRateRow {
  id: string;
  name?: string | null;
  type?: string | null;
  price?: number | null;
  comercializadora_id?: string | null;
  provider?: string | null;
  external_rate_id?: string | number | null;
  alias_externo?: string | null;
  codigo_atr?: string | null;
  descripcion?: string | null;
  raw?: string | null;
  enabled?: number | boolean | null;
}

export type ImaginaContractEndpoint =
  | "/contrato/residencial"
  | "/contrato/empresa";

export interface ImaginaContractBuildInput {
  tenant: string;
  webhookRootDomain: string;
  tramite: TramiteDB;
  client: ClientDB;
  contract: ContractDB;
  signer?: SignerDB | null;
  rate?: ImaginaRateRow | null;
  referenciaExterna?: string;
}

export interface ImaginaContractBuildSuccess {
  ok: true;
  endpoint: ImaginaContractEndpoint;
  payload: Record<string, unknown>;
  referenciaExterna: string;
}

export interface ImaginaContractBuildFailure {
  ok: false;
  error: string;
  missing: ImaginaValidationError[];
}

export type ImaginaContractBuildResult =
  | ImaginaContractBuildSuccess
  | ImaginaContractBuildFailure;

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const normalizeSupplierName = normalizeText;

export const isImaginaSupplierName = (name?: string | null): boolean =>
  Boolean(name && normalizeText(name) === normalizeText(IMAGINA_SUPPLIER_NAME));

const hasValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeCups = (cups?: string | null): string =>
  (cups || "").replace(/\s+/g, "").toUpperCase();

const addMissing = (
  missing: ImaginaValidationError[],
  field: string,
  source: string,
  message: string,
): void => {
  missing.push({ field, source, message });
};

const parseBooleanish = (
  value: boolean | number | null | undefined,
  fallback: boolean,
): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return fallback;
};

const isAltaNuevaContract = (contract: ContractDB): boolean =>
  normalizeText(contract.type) === "alta nueva";

const normalizePhonePrefix = (prefix?: string | null): string =>
  hasValue(prefix) ? prefix.replace(/^\+/, "").trim() : "34";

const mapDocumentType = (documentType?: string | null): string | null => {
  const normalized = normalizeText(documentType || "");
  if (normalized === "dni" || normalized === "nif") return "NIF";
  if (normalized === "nie") return "NIE";
  if (normalized === "cif") return "CIF";
  if (normalized === "pasaporte" || normalized === "passport") {
    return "Pasaporte";
  }
  return null;
};

const inferPersonDocumentType = (documentNumber?: string | null): string | null => {
  const normalized = (documentNumber || "").trim().toUpperCase();
  if (/^[XYZ]\d{7}[A-Z]$/.test(normalized)) return "NIE";
  if (/^\d{8}[A-Z]$/.test(normalized)) return "NIF";
  return null;
};

const toWatts = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return Number.NaN;
  if (value > 0 && value < 100) return Math.round(value * 1000);
  return Math.round(value);
};

const buildPowerArray = (
  contract: ContractDB,
  missing: ImaginaValidationError[],
): number[] => {
  const powers = [
    contract.pot1,
    contract.pot2,
    contract.pot3,
    contract.pot4,
    contract.pot5,
    contract.pot6,
  ].map(Number);

  if (powers.some((power) => !Number.isFinite(power) || power < 0)) {
    addMissing(
      missing,
      "potencia_contratada",
      "contracts",
      "Revisa las potencias P1..P6: deben ser números positivos o cero",
    );
    return [];
  }

  const watts = powers.map(toWatts);
  if (watts.every((power) => power === 0)) {
    addMissing(
      missing,
      "potencia_contratada",
      "contracts",
      "Completa al menos una potencia contratada; Imagina requiere P1..P6 en W",
    );
  }

  return watts;
};

const getSupplyAddress = (
  contract: ContractDB,
  missing: ImaginaValidationError[],
) => {
  const calle = contract.calle || contract.address;
  if (!hasValue(contract.tipo_via_cnmc)) {
    addMissing(
      missing,
      "tipo_via_cnmc",
      "contracts",
      "Completa el tipo de vía CNMC del punto de suministro",
    );
  }
  if (!hasValue(calle)) {
    addMissing(
      missing,
      "calle",
      "contracts",
      "Completa la calle estructurada del punto de suministro",
    );
  }
  if (!hasValue(contract.numero_finca)) {
    addMissing(
      missing,
      "numero_finca",
      "contracts",
      "Completa el número de finca del punto de suministro",
    );
  }

  return {
    calle: (calle || "").trim(),
    numero_finca: (contract.numero_finca || "").trim(),
    tipo_via_cnmc: (contract.tipo_via_cnmc || "").trim(),
    aclarador_finca: contract.aclarador_finca || undefined,
  };
};

const getHolderAddress = (
  client: ClientDB,
  missing: ImaginaValidationError[],
) => {
  const calle = client.calle || client.address;
  if (!hasValue(client.tipo_via_cnmc)) {
    addMissing(
      missing,
      "tipo_via_titular_cnmc",
      "clients",
      "Completa el tipo de vía CNMC de la dirección del titular",
    );
  }
  if (!hasValue(calle)) {
    addMissing(
      missing,
      "calle_titular",
      "clients",
      "Completa la calle estructurada de la dirección del titular",
    );
  }
  if (!hasValue(client.numero_finca)) {
    addMissing(
      missing,
      "numero_finca_titular",
      "clients",
      "Completa el número de finca de la dirección del titular",
    );
  }

  return {
    calle_titular: (calle || "").trim(),
    numero_finca_titular: (client.numero_finca || "").trim(),
    tipo_via_titular_cnmc: (client.tipo_via_cnmc || "").trim(),
    aclarador_finca_titular: client.aclarador_finca || undefined,
  };
};

const buildReferenciaExterna = (
  tramiteId: string,
  contractId: string,
  provided?: string,
): string => {
  if (hasValue(provided)) return provided.trim();
  return `NEG-${tramiteId.slice(0, 8)}-${contractId.slice(0, 8)}-${Date.now()}`;
};

const getRateId = (
  rate: ImaginaRateRow | null | undefined,
  missing: ImaginaValidationError[],
): number | null => {
  if (!rate || !hasValue(String(rate.external_rate_id || ""))) {
    addMissing(
      missing,
      "id_tarifa",
      "comercializadora_rates",
      "Selecciona una tarifa de Imagina Energia sincronizada",
    );
    return null;
  }

  const rateId = Number(rate.external_rate_id);
  if (!Number.isInteger(rateId)) {
    addMissing(
      missing,
      "id_tarifa",
      "comercializadora_rates",
      "La tarifa de Imagina seleccionada no tiene un external_rate_id numérico",
    );
    return null;
  }

  return rateId;
};

const isBusinessClient = (client: ClientDB): boolean => {
  const type = normalizeText(client.type || "");
  return (
    type.includes("empresa") ||
    type.includes("comunidad") ||
    mapDocumentType(client.document_type) === "CIF"
  );
};

export const validateAndBuildImaginaContractPayload = (
  input: ImaginaContractBuildInput,
): ImaginaContractBuildResult => {
  const missing: ImaginaValidationError[] = [];
  const { tenant, webhookRootDomain, tramite, client, contract, signer, rate } =
    input;
  const rateId = getRateId(rate, missing);
  const supplyAddress = getSupplyAddress(contract, missing);
  const holderAddress = getHolderAddress(client, missing);
  const powerArray = buildPowerArray(contract, missing);
  const titularDocumentType = mapDocumentType(client.document_type);
  const signatureChannel = contract.signature_channel || "sms";

  if (!titularDocumentType) {
    addMissing(
      missing,
      "tipo_documento_titular",
      "clients",
      "El tipo de documento debe ser DNI/NIF, NIE, CIF o Pasaporte",
    );
  }

  if (!["sms", "email", "email_otp"].includes(signatureChannel)) {
    addMissing(
      missing,
      "canal_envio",
      "contracts",
      "El canal de firma debe ser sms, email o email_otp",
    );
  }

  const commonRequired: Array<[string, string, string | null | undefined]> = [
    ["cups", "contracts", contract.CUPS],
    ["provincia", "contracts", contract.province],
    ["municipio", "contracts", contract.city],
    ["cod_postal", "contracts", contract.postal_code],
    ["iban", "clients", client.IBAN],
    ["telefono_titular", "clients", client.phone],
    ["email_titular", "clients", client.email],
    ["provincia_titular", "clients", client.province],
    ["municipio_titular", "clients", client.city],
    ["cod_postal_titular", "clients", client.postal_code],
  ];

  for (const [field, source, value] of commonRequired) {
    if (!hasValue(value)) {
      addMissing(
        missing,
        field,
        source,
        `Completa ${field} antes de enviar el contrato a Imagina`,
      );
    }
  }

  const cups = normalizeCups(contract.CUPS);
  if (hasValue(contract.CUPS) && !isCUPSWellFormed(cups)) {
    addMissing(
      missing,
      "cups",
      "contracts",
      "El CUPS debe tener 20 caracteres alfanuméricos",
    );
  }

  if (hasValue(client.IBAN) && !isIBANWellFormed(client.IBAN.trim())) {
    addMissing(missing, "iban", "clients", "El IBAN no tiene un formato válido");
  }

  if (hasValue(client.email) && !isEmailWellFormed(client.email.trim())) {
    addMissing(
      missing,
      "email_titular",
      "clients",
      "El email del titular no tiene un formato válido",
    );
  }

  if (hasValue(client.phone) && !isPhoneNumberWellFormed(client.phone.trim())) {
    addMissing(
      missing,
      "telefono_titular",
      "clients",
      "El teléfono del titular debe ser un móvil español válido",
    );
  }

  const referenciaExterna = buildReferenciaExterna(
    tramite.id,
    contract.id,
    input.referenciaExterna,
  );
  const callbackUrl = buildTenantWebhookUrl(
    tenant,
    webhookRootDomain,
    "/api/webhooks/imagina-energia/contratacion",
  );
  const changesUrl = buildTenantWebhookUrl(
    tenant,
    webhookRootDomain,
    "/api/webhooks/imagina-energia/contratos",
  );

  const commonPayload: Record<string, unknown> = {
    cups: cups ? cups.slice(0, 20) : contract.CUPS,
    provincia: contract.province,
    municipio: contract.city,
    cod_postal: contract.postal_code,
    ...supplyAddress,
    potencia_contratada: powerArray,
    id_tarifa: rateId,
    iban: client.IBAN,
    telefono_titular: client.phone,
    prefijo_telefono_titular: normalizePhonePrefix(client.phone_prefix),
    email_titular: client.email,
    provincia_titular: client.province,
    municipio_titular: client.city,
    cod_postal_titular: client.postal_code,
    ...holderAddress,
    canal_envio: signatureChannel,
    callback_url: callbackUrl,
    url_notificaciones_cambios_contrato: changesUrl,
    referencia_externa: referenciaExterna,
    inicio_contrato: "cuanto_antes",
    es_alta_nueva: isAltaNuevaContract(contract),
    mismo_titular: parseBooleanish(contract.mismo_titular, true),
    misma_potencia: parseBooleanish(contract.misma_potencia, true),
  };

  if (contract.tipo_autoconsumo_cnmc) {
    commonPayload.tipo_autoconsumo_cnmc = contract.tipo_autoconsumo_cnmc;
  }

  const business = isBusinessClient(client);

  if (business) {
    if (!hasValue(client.cnae)) {
      addMissing(
        missing,
        "id_cnae",
        "clients",
        "Completa el CNAE de la empresa antes de enviar a Imagina",
      );
    }
    if (!signer) {
      addMissing(
        missing,
        "firmante",
        "signers",
        "Completa el firmante de la empresa antes de enviar a Imagina",
      );
    }

    const signerDocumentType =
      mapDocumentType(signer?.document_type) ||
      inferPersonDocumentType(signer?.document_number);
    if (signer && !signerDocumentType) {
      addMissing(
        missing,
        "tipo_documento_firmante",
        "signers",
        "Completa el tipo de documento del firmante o usa un NIF/NIE reconocible",
      );
    }

    const businessRequired: Array<[string, string, string | null | undefined]> = [
      ["razon_social_titular", "clients", client.name],
      ["numero_documento_titular", "clients", client.document_number],
      ["nombre_firmante", "signers", signer?.name],
      ["primer_apellido_firmante", "signers", signer?.last_name],
      ["numero_documento_firmante", "signers", signer?.document_number],
    ];

    for (const [field, source, value] of businessRequired) {
      if (!hasValue(value)) {
        addMissing(
          missing,
          field,
          source,
          `Completa ${field} antes de enviar el contrato de empresa a Imagina`,
        );
      }
    }

    if (missing.length > 0) {
      return {
        ok: false,
        error:
          "El contrato no tiene todos los datos requeridos para Imagina Energia",
        missing,
      };
    }

    return {
      ok: true,
      endpoint: "/contrato/empresa",
      referenciaExterna,
      payload: {
        ...commonPayload,
        id_cnae: client.cnae,
        razon_social_titular: client.name,
        numero_documento_titular: client.document_number,
        nombre_firmante: signer?.name,
        primer_apellido_firmante: signer?.last_name,
        tipo_documento_firmante: signerDocumentType,
        numero_documento_firmante: signer?.document_number,
        telefono_firmante: signer?.phone || client.phone,
        prefijo_telefono_firmante: normalizePhonePrefix(
          signer?.phone_prefix || client.phone_prefix,
        ),
        email_firmante: signer?.email || client.email,
      },
    };
  }

  const residentialRequired: Array<[string, string, string | null | undefined]> =
    [
      ["nombre_titular", "clients", client.name],
      ["numero_documento_titular", "clients", client.document_number],
    ];

  for (const [field, source, value] of residentialRequired) {
    if (!hasValue(value)) {
      addMissing(
        missing,
        field,
        source,
        `Completa ${field} antes de enviar el contrato residencial a Imagina`,
      );
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error:
        "El contrato no tiene todos los datos requeridos para Imagina Energia",
      missing,
    };
  }

  return {
    ok: true,
    endpoint: "/contrato/residencial",
    referenciaExterna,
    payload: {
      ...commonPayload,
      nombre_titular: client.name,
      primer_apellido_titular: client.last_name || undefined,
      tipo_documento_titular: titularDocumentType,
      numero_documento_titular: client.document_number,
      telefono_firmante: client.phone,
      email_firmante: client.email,
    },
  };
};

export const documentTypeForImaginaUpload = (
  extension: string,
  filename: string,
): string => {
  const normalizedName = normalizeText(filename);
  if (normalizedName.includes("contrato")) return "Contrato";
  if (
    normalizedName.includes("dni") ||
    normalizedName.includes("nie") ||
    normalizedName.includes("cif")
  ) {
    return "Identificador Cliente";
  }
  if (normalizedName.includes("mandato")) return "Mandato";
  if (extension.toLowerCase() === "pdf") return "Otros";
  return "Otra documentación del cliente";
};
