import { describe, expect, test } from "vitest";
import {
  IMAGINA_PROVINCES,
  IMAGINA_ROAD_TYPES,
  resolveImaginaProvince,
  resolveImaginaRoadType,
} from "./catalogs";

describe("resolveImaginaProvince", () => {
  test("accepts every enum value as-is", () => {
    for (const province of IMAGINA_PROVINCES) {
      expect(resolveImaginaProvince(province)).toBe(province);
    }
  });

  test.each([
    // Lo que devuelve CartoCiudad (idioma local primero)
    ["València/Valencia", "Valencia/València"],
    ["Alacant/Alicante", "Alicante/Alacant"],
    ["Castelló/Castellón", "Castellón/Castelló"],
    ["Illes Balears", "Balears, Illes"],
    ["A Coruña", "Coruña, A"],
    ["Las Palmas", "Palmas, Las"],
    ["La Rioja", "Rioja, La"],
    ["Araba/Álava", "Araba/Álava"],
    // Nombres sueltos, mayúsculas y sin acentos
    ["VALENCIA", "Valencia/València"],
    ["valència", "Valencia/València"],
    ["Alicante", "Alicante/Alacant"],
    ["Castellón", "Castellón/Castelló"],
    ["Coruña", "Coruña, A"],
    ["  Madrid ", "Madrid"],
    ["avila", "Ávila"],
    // Nombres antiguos / castellanizados
    ["Álava", "Araba/Álava"],
    ["Vizcaya", "Bizkaia"],
    ["Guipúzcoa", "Gipuzkoa"],
    ["Gerona", "Girona"],
    ["Lérida", "Lleida"],
    ["Orense", "Ourense"],
    ["Islas Baleares", "Balears, Illes"],
    ["Baleares", "Balears, Illes"],
    ["Tenerife", "Santa Cruz de Tenerife"],
    ["Principado de Asturias", "Asturias"],
  ])("maps %s → %s", (input, expected) => {
    expect(resolveImaginaProvince(input)).toBe(expected);
  });

  test("returns null for empty or unknown values", () => {
    expect(resolveImaginaProvince("")).toBeNull();
    expect(resolveImaginaProvince(null)).toBeNull();
    expect(resolveImaginaProvince("Andalucía")).toBeNull();
    expect(resolveImaginaProvince("Lisboa")).toBeNull();
  });
});

describe("resolveImaginaRoadType", () => {
  test("accepts every enum value as-is", () => {
    for (const roadType of IMAGINA_ROAD_TYPES) {
      expect(resolveImaginaRoadType(roadType)).toBe(roadType);
    }
  });

  test.each([
    ["CALLE", "Calle"],
    ["Avda.", "Avenida"],
    ["C/", "Calle"],
    ["Pza", "Plaza"],
    ["Ctra.", "Carretera"],
    ["Autovía", "Autopista / Autovía"],
    ["Polígono Industrial", "Políg.industrial"],
    ["Carrer", "Calle"],
    ["Avinguda", "Avenida"],
    ["Plaça", "Plaza"],
    ["Passeig", "Paseo"],
    ["Camí", "Camino"],
    ["Rúa", "Calle"],
    ["Praza", "Plaza"],
    ["Estrada", "Carretera"],
    ["Kalea", "Calle"],
    ["Etorbidea", "Avenida"],
  ])("maps %s → %s", (input, expected) => {
    expect(resolveImaginaRoadType(input)).toBe(expected);
  });

  test("returns null for unknown values", () => {
    expect(resolveImaginaRoadType("Boulevard")).toBeNull();
    expect(resolveImaginaRoadType(undefined)).toBeNull();
  });
});
