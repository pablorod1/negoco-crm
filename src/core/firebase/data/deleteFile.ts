import { storage } from "@/core/firebase/firebaseConfig";
import { resolveDocumentacionStorageFolderPaths } from "@/core/firebase/data/getFolders";
import { deleteObject, ref } from "firebase/storage";

const buildStoragePath = (segments: Array<string | undefined>) =>
  segments
    .filter((segment): segment is string => Boolean(segment) && segment !== "/")
    .join("/");

export const deleteFileFromStorage = async (
  parent_folder: string,
  folderPath: string,
  fileName: string,
  organization_id: string
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const folderPaths =
      parent_folder === "documentacion"
        ? await resolveDocumentacionStorageFolderPaths(
            folderPath,
            organization_id
          )
        : [buildStoragePath([organization_id, parent_folder, folderPath])];

    let lastError: unknown;

    for (const storageFolderPath of folderPaths) {
      try {
        await deleteObject(
          ref(storage, buildStoragePath([storageFolderPath, fileName]))
        );

        return {
          success: true,
        };
      } catch (error) {
        lastError = error;
      }
    }

    console.error("Error deleting file:", lastError);
    return {
      success: false,
      error: "Error deleting file",
    };
  } catch (error) {
    console.error("Error deleting file:", error);
    return {
      success: false,
      error: "Error deleting file",
    };
  }
};

export const deleteFiles = async (paths: string[]): Promise<void[]> => {
  try {
    const deletePromises = paths.map((path) => {
      const fileRef = ref(storage, path);
      return deleteObject(fileRef);
    });
    return Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting files:", error);
    throw error;
  }
};
