import { describe, expect, test } from "vitest";
import type { ComparativaVM } from "@/comparativas/types";
import { createEmptyClientDB, createEmptyContractDB } from "./tramite.factories";

const comparison = {
  id: "cmp",
  client: "Prueba Comparador",
  service: "Luz",
  plan: ["fijo"],
  company_id: "COM-034",
  status: "completed",
  files: [],
  negoco_estudio: {
    cups: "ES0021000000000000AA0F",
    accessTariff: "2.0TD",
    contractedKw: { P1: 2.2, P2: 2.2 },
    annualKwh: 2997,
    currentSupplierName: "Eleia Energía",
    location: { postalCode: "46007", municipality: null, province: "Valencia" },
    client: {
      name: "Ana", lastName: "García", kind: "Particular", documentNumber: "12345678Z", email: null,
      phone: null, iban: "ES91 2100 0418 4502 0005 1332", address: null, postalCode: null, city: "Valencia", province: null,
    },
  },
} as unknown as ComparativaVM;

describe("trámite from a Negoco Cloud study", () => {
  test("the client comes from the data written when completing the study", () => {
    expect(createEmptyClientDB(comparison)).toMatchObject({
      name: "Ana", last_name: "García", type: "Particular", document_type: "DNI",
      document_number: "12345678Z", IBAN: "ES9121000418450200051332", city: "Valencia",
    });
  });

  test("the contract comes from the supply and the chosen offer; SIPS fills what the client left out", () => {
    expect(createEmptyContractDB(comparison)).toMatchObject({
      CUPS: "ES0021000000000000AA0F", plan: "2.0TD", pot1: 2.2, pot2: 2.2, consumption: 2997,
      new_company: "COM-034", postal_code: "46007", province: "Valencia", city: "Valencia", type: "",
    });
  });

  test("without client data the name of the comparativa is used", () => {
    const bare = { ...comparison, negoco_estudio: { ...comparison.negoco_estudio!, client: null } };
    expect(createEmptyClientDB(bare)).toMatchObject({ name: "Prueba Comparador", document_number: "" });
  });
});
