import { describe, expect, test } from "vitest";

import {
  getDocumentLibraryStorageFolderName,
  normalizeDocumentLibraryFolderPath,
  normalizeDocumentLibraryFolderPaths,
} from "./document-library-path";

describe("document library folder path normalization", () => {
  test("uses slash as the root folder", () => {
    expect(normalizeDocumentLibraryFolderPath()).toBe("/");
    expect(normalizeDocumentLibraryFolderPath("")).toBe("/");
    expect(normalizeDocumentLibraryFolderPath("/")).toBe("/");
    expect(normalizeDocumentLibraryFolderPath(" / ")).toBe("/");
  });

  test("trims every path segment and removes empty segments", () => {
    expect(normalizeDocumentLibraryFolderPath(" TOTALENERGIES /")).toBe(
      "TOTALENERGIES"
    );
    expect(
      normalizeDocumentLibraryFolderPath(" Contratos / TOTALENERGIES / 2026 ")
    ).toBe("Contratos/TOTALENERGIES/2026");
    expect(normalizeDocumentLibraryFolderPath("//TOTALENERGIES//PDF //")).toBe(
      "TOTALENERGIES/PDF"
    );
  });

  test("returns undefined for root storage folders", () => {
    expect(getDocumentLibraryStorageFolderName("/")).toBeUndefined();
    expect(getDocumentLibraryStorageFolderName(" TOTALENERGIES /")).toBe(
      "TOTALENERGIES"
    );
  });

  test("deduplicates normalized folder lists", () => {
    expect(
      normalizeDocumentLibraryFolderPaths([
        "TOTALENERGIES",
        "TOTALENERGIES ",
        " TOTALENERGIES /",
        "Naturgy",
      ])
    ).toEqual(["TOTALENERGIES", "Naturgy"]);
  });
});
