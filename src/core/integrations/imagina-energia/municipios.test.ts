import { describe, expect, test } from "vitest";
import {
  IMAGINA_MUNICIPIOS,
  resolveImaginaMunicipio,
  searchImaginaMunicipios,
} from "./municipios";

describe("resolveImaginaMunicipio", () => {
  test("accepts every catalogue value as-is", () => {
    for (const municipio of IMAGINA_MUNICIPIOS) {
      expect(resolveImaginaMunicipio(municipio)).toBe(municipio);
    }
  });

  test.each([
    // Lo que devuelve CartoCiudad / escribe la gente
    ["Valencia", "València"],
    ["VALENCIA", "València"],
    ["Alicante", "Alicante/Alacant"],
    ["Alacant", "Alicante/Alacant"],
    ["Castellón de la Plana", "Castellón de la Plana/Castelló de la Plana"],
    ["Castelló de la Plana", "Castellón de la Plana/Castelló de la Plana"],
    ["Castellón", "Castellón de la Plana/Castelló de la Plana"],
    ["Elche", "Elche/Elx"],
    ["Elx", "Elche/Elx"],
    ["Jávea", "Jávea/Xàbia"],
    ["A Coruña", "Coruña, A"],
    ["La Coruña", "Coruña, A"],
    ["Coruña", "Coruña, A"],
    ["Las Palmas de Gran Canaria", "Palmas de Gran Canaria, Las"],
    ["Las Palmas", "Palmas de Gran Canaria, Las"],
    ["L'Hospitalet de Llobregat", "Hospitalet de Llobregat, L'"],
    ["Hospitalet de Llobregat", "Hospitalet de Llobregat, L'"],
    ["l'Alcora", "Alcora, l'"],
    ["Vitoria", "Vitoria-Gasteiz"],
    ["Vitoria Gasteiz", "Vitoria-Gasteiz"],
    ["San Sebastián", "Donostia/San Sebastián"],
    ["Donostia", "Donostia/San Sebastián"],
    ["Pamplona", "Pamplona/Iruña"],
    ["Villarreal", "Vila-real"],
    ["Vila-real", "Vila-real"],
    ["Palma de Mallorca", "Palma"],
    ["Ibiza", "Eivissa"],
    ["Orense", "Ourense"],
    ["Gerona", "Girona"],
    ["  Madrid ", "Madrid"],
  ])("maps %s → %s", (input, expected) => {
    expect(resolveImaginaMunicipio(input)).toBe(expected);
  });

  test("does not confuse a locality or a region with a municipality", () => {
    expect(resolveImaginaMunicipio("El Palmar")).toBeNull();
    expect(resolveImaginaMunicipio("Comunidad Valenciana")).toBeNull();
    expect(resolveImaginaMunicipio("")).toBeNull();
    expect(resolveImaginaMunicipio(undefined)).toBeNull();
  });
});

describe("searchImaginaMunicipios", () => {
  test("puts the exact match first, then prefixes, then partial matches", () => {
    const results = searchImaginaMunicipios("valencia", 6);

    expect(results[0]).toBe("València");
    expect(results.slice(1)).toEqual(
      expect.arrayContaining(["Valencia de Alcántara", "Valencia de Don Juan"]),
    );
    expect(results).toHaveLength(6);
  });

  test("matches article-first spellings and ignores accents", () => {
    expect(searchImaginaMunicipios("la coru")).toContain("Coruña, A");
    expect(searchImaginaMunicipios("l'hospit")[0]).toBe(
      "Hospitalet de Llobregat, L'",
    );
    expect(searchImaginaMunicipios("xabia")).toContain("Jávea/Xàbia");
  });

  test("returns nothing for an empty query", () => {
    expect(searchImaginaMunicipios("  ")).toEqual([]);
  });
});
