import { describe, expect, test } from "vitest";

import { ComercializadoraVM } from "@/comercializadoras/types";
import {
  resolveSupplierFolderName,
  splitSupplierFolders,
  supplierFolderKey,
} from "./supplier-folders";

const supplier = (
  name: string,
  overrides: Partial<ComercializadoraVM> = {}
): ComercializadoraVM => ({
  id: `COM-${name}`,
  name,
  active: true,
  logo: null,
  num_tramites: 0,
  num_files: 0,
  total_consumption: 0,
  ...overrides,
});

describe("supplierFolderKey", () => {
  test("ignores case, accents, spaces and punctuation", () => {
    expect(supplierFolderKey("TOTALENERGIES")).toBe("totalenergies");
    expect(supplierFolderKey("Total Energies")).toBe("totalenergies");
    expect(supplierFolderKey("Imagina Energía")).toBe("imaginaenergia");
    expect(supplierFolderKey(" Gana-Energía. ")).toBe("ganaenergia");
  });
});

describe("splitSupplierFolders", () => {
  test("pairs existing folders with their supplier and keeps the real name", () => {
    const { supplierFolders, otherFolders } = splitSupplierFolders(
      ["TOTALENERGIES", "Manuales", "Endesa"],
      [supplier("Endesa"), supplier("Total Energies")]
    );

    expect(supplierFolders).toEqual([
      { folderName: "Endesa", supplier: supplier("Endesa"), exists: true },
      {
        folderName: "TOTALENERGIES",
        supplier: supplier("Total Energies"),
        exists: true,
      },
    ]);
    expect(otherFolders).toEqual(["Manuales"]);
  });

  test("adds virtual folders for active suppliers without one", () => {
    const { supplierFolders, otherFolders } = splitSupplierFolders(
      [],
      [supplier("Iberdrola")]
    );

    expect(supplierFolders).toEqual([
      { folderName: "Iberdrola", supplier: supplier("Iberdrola"), exists: false },
    ]);
    expect(otherFolders).toEqual([]);
  });

  test("leaves folders of inactive suppliers as regular folders", () => {
    const { supplierFolders, otherFolders } = splitSupplierFolders(
      ["Endesa"],
      [supplier("Endesa", { active: false })]
    );

    expect(supplierFolders).toEqual([]);
    expect(otherFolders).toEqual(["Endesa"]);
  });

  test("claims only the first folder when several match the same supplier", () => {
    const { supplierFolders, otherFolders } = splitSupplierFolders(
      ["ENDESA", "Endesa"],
      [supplier("Endesa")]
    );

    expect(supplierFolders.map((folder) => folder.folderName)).toEqual([
      "ENDESA",
    ]);
    expect(otherFolders).toEqual(["Endesa"]);
  });

  test("sorts suppliers alphabetically regardless of case", () => {
    const { supplierFolders } = splitSupplierFolders(
      [],
      [supplier("naturgy"), supplier("Endesa"), supplier("Iberdrola")]
    );

    expect(supplierFolders.map((folder) => folder.supplier.name)).toEqual([
      "Endesa",
      "Iberdrola",
      "naturgy",
    ]);
  });
});

describe("resolveSupplierFolderName", () => {
  test("returns the real folder when one matches", () => {
    expect(
      resolveSupplierFolderName(["Manuales", "TOTALENERGIES"], "Total Energies")
    ).toEqual({ folderName: "TOTALENERGIES", exists: true });
  });

  test("falls back to the supplier name when none matches", () => {
    expect(resolveSupplierFolderName(["Manuales"], " Endesa ")).toEqual({
      folderName: "Endesa",
      exists: false,
    });
  });
});
