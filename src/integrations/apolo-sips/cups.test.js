import { describe, expect, test } from "bun:test";
import { getApoloSipsCupsCandidates } from "./cups.ts";

describe("getApoloSipsCupsCandidates", () => {
  test("prueba primero el CUPS tal cual lo escribió el usuario", () => {
    expect(getApoloSipsCupsCandidates("ES0031103529801001TM0F")).toEqual([
      "ES0031103529801001TM0F",
      "ES0031103529801001TM",
      "ES0031103529801001TM1P",
    ]);
  });

  test("sin sufijo, prueba primero el de la distribuidora", () => {
    expect(getApoloSipsCupsCandidates("es 0022 0000 0111 4322 hm")).toEqual([
      "ES0022000001114322HM1P",
      "ES0022000001114322HM",
      "ES0022000001114322HM0F",
    ]);
  });

  test("distribuidora sin sufijo conocido: primero los 20 caracteres", () => {
    expect(getApoloSipsCupsCandidates("ES0021000000178183CE")).toEqual([
      "ES0021000000178183CE",
      "ES0021000000178183CE0F",
      "ES0021000000178183CE1P",
    ]);
  });
});
