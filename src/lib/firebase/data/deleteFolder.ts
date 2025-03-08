import { storage } from "@/lib/firebase/firebaseConfig";
import { deleteObject, listAll, ref } from "firebase/storage";

export const deleteFolderFromStorage = async (
  folderPath: string,
  organization_id: string
): Promise<{
  success: boolean;
  errors?: string;
}> => {
  const folderRef = ref(
    storage,
    `${organization_id}/documentacion/${folderPath}`
  );

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
