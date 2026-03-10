import { storage } from "@/core/firebase/firebaseConfig";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export async function uploadBase64File(
  base64: string,
  storagePath: string,
  contentType: string,
): Promise<{ downloadURL: string }> {
  const buffer = Buffer.from(base64, "base64");
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, buffer, { contentType });
  const downloadURL = await getDownloadURL(storageRef);
  return { downloadURL };
}
