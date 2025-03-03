import { storage } from "@/firebaseConfig";
import { tursoClient } from "@/lib/libsql/client";
import { deleteObject, listAll, ref } from "firebase/storage";

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
  await tursoClient.execute({
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

export const deleteAvatar = async (
  user_id: string
): Promise<{
  success: boolean;
  errors?: string;
}> => {
  const folderRef = ref(storage, `avatars/${user_id}`);

  if (!folderRef) {
    return {
      success: false,
      errors: "Folder not found",
    };
  }

  const files = await listAll(folderRef);
  const deleteFiles = await Promise.all(
    files.items.map((fileRef) => deleteObject(fileRef))
  );

  if (deleteFiles.length === 0) {
    return {
      success: false,
      errors: "File not found",
    };
  }

  const response = await tursoClient.execute({
    sql: `UPDATE user SET image = ? WHERE id = ?`,
    args: [null, user_id],
  });

  if (response.rowsAffected === 0) {
    return {
      success: false,
      errors: "User not found",
    };
  }

  return {
    success: true,
  };
};
