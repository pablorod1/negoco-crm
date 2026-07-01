import { describe, expect, test } from "vitest";
import type {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
} from "@/tramites/types";
import { validateAndBuildImaginaContractPayload } from "./mappers";

const tramite: TramiteDB = {
  id: "tramite-12345678",
  creation_date: "",
  tramitation_date: "",
  activation_date: "",
  renovation_date: "",
  collection_date: null,
  payment_date: null,
  rejected_date: null,
  sales_name: "Sales",
  comision_sales_person: 0,
  comision: 0,
  status: "Verificado",
  liquidez_status: null,
  notes: [],
  internal_notes: [],
  client_id: "client-1",
  user_id: "user-1",
  renewal_count: 0,
};

const residentialClient: ClientDB = {
  id: "client-1",
  name: "Juan",
  last_name: "Perez",
  email: "juan@example.test",
  type: "Particular",
  phone: "600000000",
  address: "Alcala",
  postal_code: "28001",
  province: "Madrid",
  city: "Madrid",
  document_type: "DNI",
  document_number: "12345678A",
  IBAN: "ES9121000418450200051332",
  coordinates: null,
  tipo_via_cnmc: "Calle",
  calle: "Alcala",
  numero_finca: "1",
  phone_prefix: "34",
};

const contract: ContractDB = {
  id: "contract-12345678",
  type: "Luz",
  province: "Madrid",
  city: "Madrid",
  address: "Alcala",
  postal_code: "28001",
  old_company: "Otra",
  new_company: "Imagina Energía",
  plan: "fijo",
  consumption: 1000,
  CUPS: "ES0026000010979933FW",
  pot1: 4.6,
  pot2: 4.6,
  pot3: 0,
  pot4: 0,
  pot5: 0,
  pot6: 0,
  description: "",
  tramite_id: "tramite-12345678",
  rate_id: "rate-1",
  tipo_via_cnmc: "Calle",
  calle: "Alcala",
  numero_finca: "1",
};

const rate = {
  id: "rate-1",
  provider: "imagina_energia",
  external_rate_id: "11001",
};

describe("Imagina contract mapper", () => {
  test("blocks submission when no Imagina rate is selected", () => {
    const result = validateAndBuildImaginaContractPayload({
      tenant: "tenant",
      webhookRootDomain: "negoco.test",
      tramite,
      client: residentialClient,
      contract: { ...contract, rate_id: null },
      rate: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing.map((item) => item.field)).toContain("id_tarifa");
    }
  });

  test("builds residential payload and converts kW powers to W", () => {
    const result = validateAndBuildImaginaContractPayload({
      tenant: "tenant",
      webhookRootDomain: "negoco.test",
      tramite,
      client: residentialClient,
      contract,
      rate,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("/contrato/residencial");
      expect(result.payload.id_tarifa).toBe(11001);
      expect(result.payload.potencia_contratada).toEqual([
        4600, 4600, 0, 0, 0, 0,
      ]);
      expect(result.payload.canal_envio).toBe("sms");
      expect(result.payload.es_alta_nueva).toBe(false);
      expect(result.payload.callback_url).toBe(
        "https://tenant.negoco.test/api/webhooks/imagina-energia/contratacion",
      );
    }
  });

  test("derives new supply flag from contract type", () => {
    const result = validateAndBuildImaginaContractPayload({
      tenant: "tenant",
      webhookRootDomain: "negoco.test",
      tramite,
      client: residentialClient,
      contract: { ...contract, type: "Alta Nueva" },
      rate,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.es_alta_nueva).toBe(true);
    }
  });

  test("requires CNAE and signer data for companies", () => {
    const companyClient: ClientDB = {
      ...residentialClient,
      type: "Empresa",
      document_type: "CIF",
      document_number: "B12345678",
      cnae: null,
    };
    const signer: SignerDB = {
      id: "signer-1",
      name: "",
      last_name: "",
      email: "firmante@example.test",
      phone: "600000001",
      document_number: "",
      cargo: "Administrador",
      client_id: "client-1",
    };

    const result = validateAndBuildImaginaContractPayload({
      tenant: "tenant",
      webhookRootDomain: "negoco.test",
      tramite,
      client: companyClient,
      contract,
      signer,
      rate,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing.map((item) => item.field)).toEqual(
        expect.arrayContaining([
          "id_cnae",
          "nombre_firmante",
          "primer_apellido_firmante",
          "numero_documento_firmante",
        ]),
      );
    }
  });
});
