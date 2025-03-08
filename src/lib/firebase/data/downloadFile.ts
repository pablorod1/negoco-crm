import { storage } from "@/lib/firebase/firebaseConfig";
import { getDownloadURL, ref } from "firebase/storage";

export const downloadFile = async (
  folder_name: string,
  file_name: string,
  organization_id: string
): Promise<{ success: boolean; errors?: string }> => {
  try {
    const fileRef = ref(
      storage,
      `${organization_id}/${folder_name}/${file_name}`
    );
    const url = await getDownloadURL(fileRef);
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, errors: "Network response was not ok" };
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = file_name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);

    return { success: true };
  } catch (error) {
    console.error("Error downloading file:", error);
    return { success: false, errors: "Error downloading file" };
  }
};
