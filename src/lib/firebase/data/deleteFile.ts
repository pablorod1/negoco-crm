import { storage } from "@/lib/firebase/firebaseConfig";
import { deleteObject, ref } from "firebase/storage";

export const deleteFileFromStorage = async (
  parent_folder: string,
  folderPath: string,
  fileName: string,
  organization_id: string
): Promise<{
  success: boolean;
  errors?: string;
}> => {
  const fileRef = ref(
    storage,
    `${organization_id}/${parent_folder}/${folderPath}/${fileName}`
  );

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
