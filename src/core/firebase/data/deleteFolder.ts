import { resolveDocumentacionStorageFolderPaths } from "@/core/firebase/data/getFolders";
import {
  deleteStorageObjects,
  listDocumentacionObjects,
} from "./documentacionStorage";

const buildStoragePath = (segments: Array<string | undefined>) =>
  segments
    .filter((segment): segment is string => Boolean(segment) && segment !== "/")
    .join("/");

/** Borra la carpeta y todo lo que cuelga de ella, subcarpetas incluidas. */
export const deleteFolderFromStorage = async (
  parent_folder: string,
  folderPath: string,
  organization_id: string
): Promise<{
  success: boolean;
  errors?: string;
}> => {
  const folderPaths =
    parent_folder === "documentacion"
      ? await resolveDocumentacionStorageFolderPaths(folderPath, organization_id)
      : [buildStoragePath([organization_id, parent_folder, folderPath])];

  for (const storageFolderPath of folderPaths) {
    const objects = await listDocumentacionObjects(storageFolderPath);
    await deleteStorageObjects(objects, "DELETE-FOLDER");
  }

  return {
    success: true,
  };
};
