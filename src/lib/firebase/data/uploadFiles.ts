import { storage } from "@/lib/firebase/firebaseConfig";
import { User } from "@/lib/core/types";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
} from "firebase/storage";

export async function uploadFile(
  file: File,
  parent_folder_name: string,
  folder_name?: string
): Promise<{ downloadURL: string; previewURL?: string; file_path?: string }> {
  try {
    // Subir el archivo original
    const storageRef = ref(
      storage,
      `${parent_folder_name}/${folder_name}/${file.name}`
    );
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    // Generar previewURL
    let previewURL: string | undefined = undefined;

    // Si es una imagen o PDF, usar la misma URL como preview
    if (file.type.startsWith("image/")) {
      previewURL = downloadURL;
    }

    const file_path = `${parent_folder_name}/${folder_name}/${file.name}`;

    return { downloadURL, previewURL, file_path };
  } catch (error) {
    console.error("Error subiendo archivo:", error);
    throw error;
  }
}

export async function uploadFiles(
  files: File[],
  parent_folder_name: string,
  folder_name?: string
): Promise<{ downloadURL: string; previewURL?: string }[]> {
  try {
    const uploads = files.map((file) =>
      uploadFile(file, parent_folder_name, folder_name)
    );
    return Promise.all(uploads);
  } catch (error) {
    console.error("Error subiendo archivos:", error);
    throw error;
  }
}

export async function uploadAvatar(
  file: File,
  userData: User
): Promise<{ downloadURL: string }> {
  try {
    const folderRef = ref(
      storage,
      `${userData.organization.id}/avatars/${userData.id}`
    );

    // Delete existing files in folder
    const files = await listAll(folderRef);
    await Promise.all(files.items.map((fileRef) => deleteObject(fileRef)));

    // Upload new file
    const storageRef = ref(
      storage,
      `${userData.organization.id}/avatars/${userData.id}/${file.name}`
    );
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return { downloadURL };
  } catch (error) {
    console.error("Error subiendo archivo:", error);
    throw error;
  }
}
