import { describe, expect, test } from "vitest";

import { ComercializadoraVM } from "@/comercializadoras/types";
import {
  buildFolderTree,
  filterFolderTree,
  findFolderNode,
  folderAncestors,
  validateNewFolderName,
} from "./folder-tree";

const supplier = (name: string): ComercializadoraVM => ({
  id: `COM-${name}`,
  name,
  active: true,
  logo: null,
  num_tramites: 0,
  num_files: 0,
  total_consumption: 0,
});

const paths = [
  "Manuales",
  "Manuales/2026",
  "Manuales/2026/Enero",
  "TOTALENERGIES",
  "TOTALENERGIES/Contratos",
  "Zeta",
];

describe("buildFolderTree", () => {
  test("splits supplier folders from the rest and nests children", () => {
    const tree = buildFolderTree(paths, [
      supplier("Total Energies"),
      supplier("Endesa"),
    ]);

    expect(tree.supplierFolders.map((n) => [n.name, n.virtual ?? false])).toEqual([
      ["Endesa", true],
      ["TOTALENERGIES", false],
    ]);
    expect(tree.supplierFolders[1].supplier?.name).toBe("Total Energies");
    expect(tree.supplierFolders[1].children.map((n) => n.path)).toEqual([
      "TOTALENERGIES/Contratos",
    ]);

    expect(tree.otherFolders.map((n) => n.name)).toEqual(["Manuales", "Zeta"]);
    expect(tree.otherFolders[0].children[0].children[0].path).toBe(
      "Manuales/2026/Enero"
    );
  });

  test("sorts siblings alphabetically ignoring case", () => {
    const tree = buildFolderTree(["b", "a/z", "a/B", "a", "C"], []);

    expect(tree.otherFolders.map((n) => n.name)).toEqual(["a", "b", "C"]);
    expect(tree.otherFolders[0].children.map((n) => n.name)).toEqual([
      "B",
      "z",
    ]);
  });

  test("ignores the root and normalizes sloppy paths", () => {
    const tree = buildFolderTree(["/", " Manuales / 2026 "], []);

    expect(tree.otherFolders).toHaveLength(1);
    expect(tree.otherFolders[0].path).toBe("Manuales");
    expect(tree.otherFolders[0].children[0].path).toBe("Manuales/2026");
  });
});

describe("filterFolderTree", () => {
  const tree = buildFolderTree(paths, [supplier("Total Energies")]);

  test("keeps branches with a matching descendant", () => {
    const result = filterFolderTree(tree.otherFolders, "enero");

    expect(result.map((n) => n.name)).toEqual(["Manuales"]);
    expect(result[0].children[0].children[0].name).toBe("Enero");
  });

  test("matches supplier folders by the supplier name too", () => {
    expect(
      filterFolderTree(tree.supplierFolders, "total energ").map((n) => n.name)
    ).toEqual(["TOTALENERGIES"]);
  });

  test("returns everything for an empty query", () => {
    expect(filterFolderTree(tree.otherFolders, "  ")).toBe(tree.otherFolders);
  });
});

describe("findFolderNode / folderAncestors", () => {
  test("finds nested nodes and lists ancestors", () => {
    const tree = buildFolderTree(paths, []);

    expect(findFolderNode(tree.otherFolders, "Manuales/2026/Enero")?.name).toBe(
      "Enero"
    );
    expect(findFolderNode(tree.otherFolders, "Nope")).toBeUndefined();
    expect(folderAncestors("Manuales/2026/Enero")).toEqual([
      "Manuales",
      "Manuales/2026",
    ]);
    expect(folderAncestors("/")).toEqual([]);
  });
});

describe("validateNewFolderName", () => {
  const tree = buildFolderTree(paths, [supplier("Endesa")]);

  test("rejects empty names and slashes", () => {
    expect(validateNewFolderName("  ", "/", tree)).toMatch(/nombre/);
    expect(validateNewFolderName("a/b", "/", tree)).toMatch(/«\/»/);
  });

  test("rejects duplicates among siblings, ignoring case and virtual folders included", () => {
    expect(validateNewFolderName("manuales", "/", tree)).toMatch(/Ya existe/);
    expect(validateNewFolderName("ENDESA", "/", tree)).toMatch(/Ya existe/);
    expect(validateNewFolderName("2026", "Manuales", tree)).toMatch(
      /Ya existe/
    );
  });

  test("accepts a new name in the chosen parent", () => {
    expect(validateNewFolderName("2027", "Manuales", tree)).toBeNull();
    expect(validateNewFolderName("Manuales", "Zeta", tree)).toBeNull();
    expect(validateNewFolderName("Facturas", "/", tree)).toBeNull();
  });
});
