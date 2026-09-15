import { describe, expect, test } from "vitest";
import {
  companyLogoUrl,
  isCompanyLogoFile,
  isUnoptimizedLogo,
} from "./logo-url";

describe("companyLogoUrl", () => {
  test("sirve los logos que venían en el repo como fichero estático", () => {
    expect(companyLogoUrl("ganaenergia.webp")).toBe("/companies/ganaenergia.webp");
    expect(companyLogoUrl("edp.svg")).toBe("/companies/edp.svg");
  });

  test("pide a la base de control los que se suben desde el backoffice", () => {
    expect(companyLogoUrl("adt.webp")).toBe("/api/company-logos/adt.webp");
  });

  test("no rompe con los valores vacíos que ya hay en las tablas", () => {
    // "Otra" existe en todos los tenants con el logo a cadena vacía.
    expect(companyLogoUrl("")).toBeNull();
    expect(companyLogoUrl(null)).toBeNull();
    expect(companyLogoUrl(undefined)).toBeNull();
    expect(companyLogoUrl("   ")).toBeNull();
  });

  test("rechaza nombres que se saldrían de la carpeta de logos", () => {
    expect(companyLogoUrl("../../etc/passwd")).toBeNull();
    expect(companyLogoUrl("logo.exe")).toBeNull();
    expect(isCompanyLogoFile("a/b.webp")).toBe(false);
  });

  test("marca los SVG para que next/image no intente optimizarlos", () => {
    expect(isUnoptimizedLogo("candela.svg")).toBe(true);
    expect(isUnoptimizedLogo("naturgy.webp")).toBe(false);
    expect(isUnoptimizedLogo(null)).toBe(false);
  });
});
