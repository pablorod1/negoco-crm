import { storage } from "@/lib/firebase/firebaseConfig";
import { deleteObject, ref } from "firebase/storage";

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
    const fileRef = ref(
      storage,
      `${organization_id}/${parent_folder}/${folderPath}/${fileName}`
    );

    if (!fileRef) {
      return {
        success: false,
        error: "File not found",
      };
    }

    await deleteObject(fileRef);

    return {
      success: true,
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
