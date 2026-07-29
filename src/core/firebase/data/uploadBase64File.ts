import { storage } from "@/core/firebase/firebaseConfig";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

interface UploadBase64FileOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export async function uploadBase64File(
  base64: string,
  storagePath: string,
  contentType: string,
  options: UploadBase64FileOptions = {},
): Promise<{ downloadURL: string }> {
  if (options.signal?.aborted) {
    throw abortError("Upload aborted");
  }

  const buffer = Buffer.from(base64, "base64");
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, buffer, {
    contentType,
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      options.signal?.removeEventListener("abort", handleAbort);
      unsubscribe();
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const handleAbort = () => {
      rejectOnce(abortError("Upload aborted"));
      uploadTask.cancel();
    };
    unsubscribe = uploadTask.on(
      "state_changed",
      undefined,
      rejectOnce,
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ downloadURL });
        } catch (error) {
          rejectOnce(error);
        }
      },
    );
    if (settled) unsubscribe();

    options.signal?.addEventListener("abort", handleAbort, { once: true });
    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        rejectOnce(abortError("Upload timed out"));
        uploadTask.cancel();
      }, options.timeoutMs);
    }
  });
}
