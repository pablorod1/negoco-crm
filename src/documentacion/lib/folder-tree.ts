import { ComercializadoraVM } from "@/comercializadoras/types";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import { splitSupplierFolders, supplierFolderKey } from "./supplier-folders";

/**
 * Árbol de carpetas de Documentación, compartido por el sidebar y el selector
 * de carpeta destino al subir. Las de primer nivel que pertenecen a una
 * comercializadora activa llevan su `supplier` (y `virtual` si aún no existen
 * en Storage).
 */
export interface FolderNode {
  path: string;
  name: string;
  parent: string;
  children: FolderNode[];
  supplier?: ComercializadoraVM;
  virtual?: boolean;
}

export interface FolderTree {
  supplierFolders: FolderNode[];
  otherFolders: FolderNode[];
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

function sortNodes(nodes: FolderNode[]) {
  nodes.sort((a, b) => collator.compare(a.name, b.name));
  nodes.forEach((node) => sortNodes(node.children));
}

export function buildFolderTree(
  paths: string[],
  suppliers: ComercializadoraVM[]
): FolderTree {
  const nodes = new Map<string, FolderNode>();

  // Cada ruta crea también los ancestros que falten ("a/b/c" ⇒ "a", "a/b")
  paths.forEach((rawPath) => {
    const path = normalizeDocumentLibraryFolderPath(rawPath);
    if (path === "/") return;

    [...folderAncestors(path), path].forEach((current) => {
      if (nodes.has(current)) return;
      const parts = current.split("/");
      nodes.set(current, {
        path: current,
        name: parts[parts.length - 1],
        parent: parts.slice(0, -1).join("/"),
        children: [],
      });
    });
  });

  const roots: FolderNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parent ? nodes.get(node.parent) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const { supplierFolders, otherFolders } = splitSupplierFolders(
    roots.map((node) => node.path),
    suppliers
  );
  const rootsByPath = new Map(roots.map((node) => [node.path, node]));

  const supplierNodes = supplierFolders.map((folder): FolderNode => {
    const existing = rootsByPath.get(folder.folderName);
    return existing
      ? { ...existing, supplier: folder.supplier }
      : {
          path: folder.folderName,
          name: folder.folderName,
          parent: "",
          children: [],
          supplier: folder.supplier,
          virtual: true,
        };
  });
  const otherNodes = otherFolders
    .map((path) => rootsByPath.get(path))
    .filter((node): node is FolderNode => node !== undefined);

  sortNodes(otherNodes);
  supplierNodes.forEach((node) => sortNodes(node.children));

  return { supplierFolders: supplierNodes, otherFolders: otherNodes };
}

/** Nodos que coinciden con la búsqueda o tienen algún descendiente que coincide. */
export function filterFolderTree(
  nodes: FolderNode[],
  query: string
): FolderNode[] {
  const key = supplierFolderKey(query);
  if (!key) return nodes;

  return nodes.flatMap((node) => {
    const children = filterFolderTree(node.children, query);
    const matches =
      supplierFolderKey(node.name).includes(key) ||
      (node.supplier
        ? supplierFolderKey(node.supplier.name).includes(key)
        : false);

    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
}

export function findFolderNode(
  nodes: FolderNode[],
  path: string
): FolderNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = findFolderNode(node.children, path);
    if (found) return found;
  }
  return undefined;
}

/** "Inicio / Endesa / Contratos", para enseñar una ruta en la UI. */
export function describeFolderPath(path: string): string {
  const normalized = normalizeDocumentLibraryFolderPath(path);
  return normalized === "/"
    ? "Inicio"
    : ["Inicio", ...normalized.split("/")].join(" / ");
}

/** Rutas de todos los ancestros de `path` ("a/b/c" → ["a", "a/b"]). */
export function folderAncestors(path: string): string[] {
  const normalized = normalizeDocumentLibraryFolderPath(path);
  if (normalized === "/") return [];
  const parts = normalized.split("/");
  return parts
    .slice(0, -1)
    .map((_, index) => parts.slice(0, index + 1).join("/"));
}

/**
 * Valida el nombre de una carpeta nueva dentro de `parentPath`. Devuelve el
 * mensaje de error o `null` si es válido.
 */
export function validateNewFolderName(
  name: string,
  parentPath: string,
  tree: FolderTree
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Escribe un nombre para la carpeta.";
  if (trimmed.includes("/")) return "El nombre no puede contener «/».";

  const roots = [...tree.supplierFolders, ...tree.otherFolders];
  const parent =
    normalizeDocumentLibraryFolderPath(parentPath) === "/"
      ? undefined
      : findFolderNode(roots, normalizeDocumentLibraryFolderPath(parentPath));
  const siblings = parent ? parent.children : roots;
  const key = supplierFolderKey(trimmed);

  if (siblings.some((sibling) => supplierFolderKey(sibling.name) === key)) {
    return "Ya existe una carpeta con ese nombre aquí.";
  }

  return null;
}
