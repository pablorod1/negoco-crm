import { describe, expect, test } from "vitest";
import {
  computeImaginaProgress,
  formatImaginaMissing,
  groupImaginaMissingFields,
} from "./imagina-missing-fields";

describe("groupImaginaMissingFields", () => {
  test("groups by source, keeps CRM order and translates labels", () => {
    const groups = groupImaginaMissingFields([
      { field: "cups", source: "contracts", message: "Completa cups" },
      { field: "iban", source: "clients", message: "IBAN inválido" },
      { field: "id_tarifa", source: "comercializadora_rates", message: "" },
      { field: "nombre_firmante", source: "signers", message: "Falta" },
      { field: "numero_finca", source: "contracts", message: "Falta" },
    ]);

    expect(groups.map((group) => group.source)).toEqual([
      "clients",
      "signers",
      "contracts",
      "comercializadora_rates",
    ]);
    expect(groups[0]).toMatchObject({
      label: "Cliente",
      items: [{ field: "iban", label: "IBAN", message: "IBAN inválido" }],
    });
    expect(groups[1].label).toBe("Firmante");
    expect(groups[2].items.map((item) => item.label)).toEqual([
      "CUPS",
      "Número de finca del suministro",
    ]);
    expect(groups[3].items[0].label).toBe("Tarifa de Imagina Energía");
  });

  test("falls back to the raw field and a generic source", () => {
    const [group] = groupImaginaMissingFields([{ field: "campo_nuevo" }]);

    expect(group.label).toBe("Otros datos");
    expect(group.items[0].label).toBe("campo_nuevo");
  });

  test("returns nothing for empty input", () => {
    expect(groupImaginaMissingFields(undefined)).toEqual([]);
    expect(groupImaginaMissingFields([])).toEqual([]);
  });
});

describe("computeImaginaProgress", () => {
  test("counts required fields not reported as missing", () => {
    expect(
      computeImaginaProgress(
        ["cups", "iban", "id_tarifa", "email_titular"],
        [
          { field: "iban", source: "clients" },
          // Un error repetido sobre el mismo campo cuenta una sola vez.
          { field: "iban", source: "clients" },
          // Campos fuera de la lista no restan progreso.
          { field: "canal_envio_extra", source: "contracts" },
        ],
      ),
    ).toEqual({ total: 4, completed: 3, percent: 75 });
  });

  test("is complete when nothing is required or missing", () => {
    expect(computeImaginaProgress([], [])).toEqual({
      total: 0,
      completed: 0,
      percent: 100,
    });
    expect(computeImaginaProgress(["cups"], undefined)).toEqual({
      total: 1,
      completed: 1,
      percent: 100,
    });
  });
});

describe("formatImaginaMissing", () => {
  test("produces one readable line per field", () => {
    expect(
      formatImaginaMissing([
        { field: "telefono_titular", source: "clients" },
        { field: "cups", source: "contracts" },
      ]),
    ).toBe("Cliente · Teléfono del titular\nContrato · CUPS");
  });

  test("is undefined when there is nothing to show", () => {
    expect(formatImaginaMissing(undefined)).toBeUndefined();
    expect(formatImaginaMissing([])).toBeUndefined();
  });
});
