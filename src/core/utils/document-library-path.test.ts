import { describe, expect, test } from "vitest";

import {
  getFirebaseStoragePathFromDownloadUrl,
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

  test("extracts exact Firebase Storage paths from download URLs", () => {
    expect(
      getFirebaseStoragePathFromDownloadUrl(
        "https://firebasestorage.googleapis.com/v0/b/bucket/o/org%2Fdocumentacion%2FTOTALENERGIES%20%2FOferta%2Bv1.pdf?alt=media&token=abc"
      )
    ).toBe("org/documentacion/TOTALENERGIES /Oferta+v1.pdf");
    expect(getFirebaseStoragePathFromDownloadUrl("not a url")).toBeUndefined();
  });
});
