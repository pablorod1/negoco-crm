import { storage } from "@/core/firebase/firebaseConfig";
import {
  normalizeDocumentLibraryFolderPath,
  normalizeDocumentLibraryFolderPaths,
} from "@/core/utils/document-library-path";
import { listAll, ref } from "firebase/storage";

export const getFoldersFromDocumentacion = async (
  organization_id: string
): Promise<{
  success: boolean;
  errors?: string;
  data: string[];
}> => {
  try {
    const folderRef = ref(storage, `${organization_id}/documentacion/`);
    const folders = await listAll(folderRef);

    if (folders.prefixes.length === 0) {
      return {
        success: false,
        errors: "No se encontraron carpetas",
        data: [],
      };
    }

    return {
      success: true,
      data: normalizeDocumentLibraryFolderPaths(
        folders.prefixes.map((folder) => folder.name)
      ),
    };
  } catch (error) {
    console.error("Error obteniendo carpetas:", error);
    throw error;
  }
};

export async function getAllFoldersWithPaths(organization_id: string) {
  try {
    const paths: string[] = [];
    await traverseFolder(
      `${organization_id}/documentacion`,
      paths,
      organization_id
    );

    // Convertimos las rutas para que sean relativas a la carpeta documentacion
    const relativePaths = normalizeDocumentLibraryFolderPaths(
      paths.map((path) =>
        path.startsWith(`${organization_id}/documentacion/`)
          ? path.slice((organization_id + "/documentacion").length + 1)
          : ""
      )
    );

    // Ordenamos las rutas
    relativePaths.sort((a, b) => {
      const depthA = a.split("/").length;
      const depthB = b.split("/").length;
      if (depthA === depthB) {
        return a.localeCompare(b);
      }
      return depthA - depthB;
    });

    return {
      success: true,
      data: relativePaths,
    };
  } catch (error) {
    console.error("Error getting all folders:", error);
    return {
      success: false,
      error: "Error getting folders",
    };
  }
}

async function traverseFolder(
  folderPath: string,
  paths: string[],
  organization_id: string
) {
  const folderRef = ref(storage, folderPath);

  try {
    const result = await listAll(folderRef);

    // Solo agregamos la ruta si no es la carpeta raíz y contiene elementos
    if (
      folderPath !== `${organization_id}/documentacion` &&
      (result.prefixes.length > 0 || result.items.length > 0)
    ) {
      paths.push(folderPath);
    }

    // Recursivamente exploramos todas las subcarpetas
    for (const prefix of result.prefixes) {
      await traverseFolder(prefix.fullPath, paths, organization_id);
    }
  } catch (error) {
    console.error(`Error traversing folder ${folderPath}:`, error);
    throw error;
  }
}

export async function resolveDocumentacionStorageFolderPaths(
  folderPath: string,
  organization_id: string
) {
  const rootPath = `${organization_id}/documentacion`;
  const normalizedFolderPath = normalizeDocumentLibraryFolderPath(folderPath);

  if (normalizedFolderPath === "/") {
    return [rootPath];
  }

  let currentPaths = [rootPath];

  for (const segment of normalizedFolderPath.split("/")) {
    const nextPaths = new Set<string>();

    for (const currentPath of currentPaths) {
      const result = await listAll(ref(storage, currentPath));
      const matchingPrefixes = result.prefixes.filter(
        (prefix) => normalizeDocumentLibraryFolderPath(prefix.name) === segment
      );

      if (matchingPrefixes.length > 0) {
        matchingPrefixes.forEach((prefix) => nextPaths.add(prefix.fullPath));
      } else {
        nextPaths.add(`${currentPath}/${segment}`);
      }
    }

    currentPaths = Array.from(nextPaths);
  }

  return currentPaths;
}

export async function getSubFoldersFromFolder(
  folderPath: string = "",
  organization_id: string
) {
  try {
    const fullPaths = await resolveDocumentacionStorageFolderPaths(
      folderPath,
      organization_id
    );
    const results = await Promise.all(
      fullPaths.map((fullPath) => listAll(ref(storage, fullPath)))
    );

    const subfolders = normalizeDocumentLibraryFolderPaths(
      results.flatMap((result) => result.prefixes.map((prefix) => prefix.name))
    );

    return {
      success: true,
      data: subfolders,
    };
  } catch (error) {
    console.error("Error getting subfolders:", error);
    return {
      success: false,
      error: "Error getting subfolders",
    };
  }
}

export const getItemsCountFromFolder = async (
  folder: string,
  organization_id: string
): Promise<{ success: boolean; items: number }> => {
  try {
    const fullPaths = await resolveDocumentacionStorageFolderPaths(
      folder,
      organization_id
    );
    const results = await Promise.all(
      fullPaths.map((fullPath) => listAll(ref(storage, fullPath)))
    );
    const itemCount = results.reduce(
      (count, items) => count + items.items.length + items.prefixes.length,
      0
    );

    if (itemCount === 0) {
      return {
        success: false,
        items: 0,
      };
    }

    return {
      success: true,
      items: itemCount,
    };
  } catch (error) {
    console.error("Error obteniendo cantidad de items:", error);
    throw error;
  }
};
