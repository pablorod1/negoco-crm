import { getBytes, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/core/firebase/firebaseConfig";
import type { IngestFile } from "./types";

/** Tamaño máximo de un anexo: el PDF más grande recibido ronda los 9 MB. */
export const MAX_RATE_FILE_BYTES = 20 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, "_").slice(0, 120) || "documento";
}

/** Guarda el documento original de una ingesta. Los anexos no llevan datos de clientes. */
export async function storeIngestFile({
  tenantSlug,
  ingestId,
  name,
  mime,
  data,
}: {
  tenantSlug: string;
  ingestId: string;
  name: string;
  mime: string;
  data: Uint8Array;
}): Promise<IngestFile> {
  const path = `comparador/${tenantSlug}/tarifas/${ingestId}/${safeName(name)}`;
  await uploadBytes(ref(storage, path), data, { contentType: mime });
  return { path, name, mime, size: data.byteLength };
}

/** Enlace para abrir el original desde la revisión. */
export async function ingestFileUrl(file: IngestFile): Promise<string | null> {
  try {
    return await getDownloadURL(ref(storage, file.path));
  } catch {
    return null;
  }
}

export async function readIngestFile(file: IngestFile): Promise<Uint8Array> {
  return new Uint8Array(await getBytes(ref(storage, file.path), MAX_RATE_FILE_BYTES));
}
