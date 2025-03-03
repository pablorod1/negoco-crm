import { storage } from "@/firebaseConfig";
import { tursoClient } from "@/lib/libsql/client";
import { deleteObject, listAll, ref } from "firebase/storage";

export const deleteFolderFromStorage = async (
  folderPath: string
): Promise<{
  success: boolean;
  errors?: string;
}> => {
  const folderRef = ref(storage, `documentacion/${folderPath}`);

  // 1. Get all files in folder
  const files = await listAll(folderRef);

  // 2. Delete all files in folder
  await Promise.all(
    files.items.map(async (file) => {
      await deleteObject(file);
    })
  );

  return {
    success: true,
  };
};

export const deleteFolder = async (
  folderPath: string
): Promise<{ success: boolean; errors?: string }> => {
  // 1. Delete folder from Firebase Storage
  const { success: firebaseSuccess, errors: firebaseErrors } =
    await deleteFolderFromStorage(folderPath);

  const query = `DELETE FROM documentacion_files WHERE folder_name = ?`;
  // 2. Delete folder from database
  await tursoClient.execute({
    sql: query,
    args: [folderPath],
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
