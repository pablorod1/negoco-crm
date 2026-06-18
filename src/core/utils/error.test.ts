import { describe, expect, test } from "vitest";
import { getErrorMessage } from "./error";

describe("getErrorMessage", () => {
  test("returns primitive messages", () => {
    expect(getErrorMessage("Error concreto")).toBe("Error concreto");
    expect(getErrorMessage(404)).toBe("404");
  });

  test("formats Error instances", () => {
    expect(getErrorMessage(new Error("No autorizado"))).toBe("No autorizado");
  });

  test("formats libsql-like error objects", () => {
    expect(
      getErrorMessage({ code: "SQLITE_CONSTRAINT", name: "LibsqlError" })
    ).toBe("LibsqlError (SQLITE_CONSTRAINT)");
  });

  test("uses fallback for empty values", () => {
    expect(getErrorMessage("", "Error por defecto")).toBe("Error por defecto");
    expect(getErrorMessage(null, "Error por defecto")).toBe("Error por defecto");
  });
});
