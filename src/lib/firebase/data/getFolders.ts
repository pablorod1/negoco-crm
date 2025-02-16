import { storage } from "@/firebaseConfig";
import { listAll, ref } from "firebase/storage";

export const getFoldersFromDocumentacion = async (): Promise<{
  success: boolean;
  errors?: string;
  data: string[];
}> => {
  try {
    const folderRef = ref(storage, "documentacion");
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

const ROOT_FOLDER = "documentacion";

export async function getAllFoldersWithPaths() {
  try {
    const paths: string[] = [];
    await traverseFolder(ROOT_FOLDER, paths);

    // Convertimos las rutas para que sean relativas a la carpeta documentacion
    const relativePaths = paths.map((path) =>
      path.startsWith(`${ROOT_FOLDER}/`)
        ? path.slice(ROOT_FOLDER.length + 1)
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

async function traverseFolder(folderPath: string, paths: string[]) {
  const folderRef = ref(storage, folderPath);

  try {
    const result = await listAll(folderRef);

    // Solo agregamos la ruta si no es la carpeta raíz y contiene elementos
    if (
      folderPath !== ROOT_FOLDER &&
      (result.prefixes.length > 0 || result.items.length > 0)
    ) {
      paths.push(folderPath);
    }

    // Recursivamente exploramos todas las subcarpetas
    for (const prefix of result.prefixes) {
      await traverseFolder(prefix.fullPath, paths);
    }
  } catch (error) {
    console.error(`Error traversing folder ${folderPath}:`, error);
    throw error;
  }
}

export async function getSubFoldersFromFolder(folderPath: string = "") {
  try {
    const fullPath = folderPath ? `${ROOT_FOLDER}/${folderPath}` : ROOT_FOLDER;
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

export const getItemsCountFromFolder = async (
  folder: string
): Promise<{ success: boolean; items: number }> => {
  try {
    const folderRef = ref(storage, `documentacion/${folder}/`);
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
