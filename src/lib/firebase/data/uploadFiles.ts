import { storage } from "@/firebaseConfig";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export async function uploadFile(
  file: File,
  parent_folder_name: string,
  folder_name?: string
): Promise<{ downloadURL: string; previewURL?: string }> {
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

    return { downloadURL, previewURL };
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
