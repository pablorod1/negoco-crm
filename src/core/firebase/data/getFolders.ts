import { storage } from "@/core/firebase/firebaseConfig";
import { listAll, ref } from "firebase/storage";

const getFoldersFromDocumentacion = async (
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
      data: folders.prefixes.map((folder) => folder.name),
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
    const relativePaths = paths.map((path) =>
      path.startsWith(`${organization_id}/documentacion/`)
        ? path.slice((organization_id + "/documentacion").length + 1)
        : ""
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

export async function getSubFoldersFromFolder(
  folderPath: string = "",
  organization_id: string
) {
  try {
    const fullPath = folderPath
      ? `${organization_id}/documentacion/${folderPath}`
      : `${organization_id}/documentacion`;
    const folderRef = ref(storage, fullPath);
    const result = await listAll(folderRef);

    // Extraemos solo los nombres de las subcarpetas directas
    const subfolders = result.prefixes.map((prefix) => {
      const parts = prefix.fullPath.split("/");
      return parts[parts.length - 1];
    });

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

const getItemsCountFromFolder = async (
  folder: string,
  organization_id: string
): Promise<{ success: boolean; items: number }> => {
  try {
    const folderRef = ref(
      storage,
      `${organization_id}/documentacion/${folder}/`
    );
    const items = await listAll(folderRef);

    if (items.items.length === 0) {
      return {
        success: false,
        items: 0,
      };
    }

    return {
      success: true,
      items: items.items.length + items.prefixes.length,
    };
  } catch (error) {
    console.error("Error obteniendo cantidad de items:", error);
    throw error;
  }
};
