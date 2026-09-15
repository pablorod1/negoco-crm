import { storage } from "@/core/firebase/firebaseConfig";
import { resolveDocumentacionStorageFolderPaths } from "@/core/firebase/data/getFolders";
import { deleteObject, listAll, ref } from "firebase/storage";

const buildStoragePath = (segments: Array<string | undefined>) =>
  segments
    .filter((segment): segment is string => Boolean(segment) && segment !== "/")
    .join("/");

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
    const files = await listAll(ref(storage, storageFolderPath));

    await Promise.all(
      files.items.map(async (file) => {
        await deleteObject(file);
      })
    );
  }

  return {
    success: true,
  };
};
