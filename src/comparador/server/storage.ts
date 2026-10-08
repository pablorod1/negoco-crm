import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/core/firebase/firebaseConfig";
import type { ProposalUploader } from "@/comparador/study/close";

/** Sube un documento de la comparativa a Storage; `remove` lo borra si la base falla. */
export const uploadToStorage: ProposalUploader = async ({ path, data, contentType = "application/pdf" }) => {
  const target = ref(storage, path);
  await uploadBytes(target, data, { contentType });
  return { downloadUrl: await getDownloadURL(target), remove: () => deleteObject(target) };
};
