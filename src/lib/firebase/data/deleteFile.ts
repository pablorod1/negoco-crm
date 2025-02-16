import { storage } from "@/firebaseConfig";
import { tursoClient } from "@/lib/libsql/client";
import { deleteObject, ref } from "firebase/storage";

export const deleteFileFromStorage = async (
  folderPath: string,
  fileName: string
): Promise<{
  success: boolean;
  errors?: string;
}> => {
  const fileRef = ref(storage, `documentacion/${folderPath}/${fileName}`);

  if (!fileRef) {
    return {
      success: false,
      errors: "File not found",
    };
  }

  await deleteObject(fileRef);

  return {
    success: true,
  };
};

export const deleteFile = async (
  folderPath: string,
  fileName: string,
  file_id: string
): Promise<{ success: boolean; errors?: string }> => {
  // 1. Delete folder from Firebase Storage
  const { success: firebaseSuccess, errors: firebaseErrors } =
    await deleteFileFromStorage(folderPath, fileName);

  const query = `DELETE FROM documentacion_files WHERE id = ?`;
  // 2. Delete folder from database
  await tursoClient().execute({
    sql: query,
    args: [file_id],
  });

  if (!firebaseSuccess) {
    return {
      success: false,
      errors: firebaseErrors,
    };
  }

  return {
    success: true,
  };
};
