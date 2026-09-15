import {
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
  type StorageReference,
} from "firebase/storage";

import { storage } from "@/core/firebase/firebaseConfig";
import {
  deleteStorageObjects,
  listDocumentacionObjects,
} from "@/core/firebase/data/documentacionStorage";
import {
  commitDocumentLibraryMove,
  DocumentLibraryMutationResult,
  planDocumentLibraryMove,
} from "./document-library-api";
import type {
  MoveCommitUpdate,
  MovePlan,
  MoveProgress,
  MoveRequest,
} from "./move-types";

interface CopyJob {
  /** Fila de la BD a la que pertenece, si la hay. */
  id?: string;
  sourceRef: StorageReference;
  destinationPath: string;
}

/**
 * Objetos a copiar: los del plan más los que cuelgan de los prefijos a vaciar
 * sin fila en la BD (para que la carpeta antigua desaparezca del listado).
 */
async function collectCopyJobs(plan: MovePlan): Promise<CopyJob[]> {
  const jobs: CopyJob[] = plan.items
    .filter((item) => !item.in_place)
    .map((item) => ({
      id: item.id,
      sourceRef: ref(storage, item.source_path),
      destinationPath: item.destination_path,
    }));
  const known = new Set(plan.items.map((item) => item.source_path));

  for (const prefix of plan.storage_prefixes) {
    const objects = await listDocumentacionObjects(prefix.source_prefix);
    for (const object of objects) {
      if (known.has(object.fullPath)) continue;
      known.add(object.fullPath);
      jobs.push({
        sourceRef: object,
        destinationPath: `${prefix.destination_prefix}/${object.fullPath.slice(prefix.source_prefix.length + 1)}`,
      });
    }
  }

  return jobs;
}

/**
 * Mueve ficheros o una carpeta. Los bytes van directamente del navegador a
 * Storage (descarga + subida por objeto); el servidor sólo planifica y
 * confirma. Si algo falla antes del commit se borran las copias y el origen
 * queda intacto.
 */
export async function moveDocumentLibrary(
  organizationId: string,
  request: MoveRequest,
  onProgress?: (progress: MoveProgress) => void
): Promise<DocumentLibraryMutationResult> {
  const planned = await planDocumentLibraryMove({ organizationId, request });
  if (!planned.success || !planned.plan) {
    return { success: false, error: planned.error, conflicts: planned.conflicts };
  }

  const plan = planned.plan;
  let jobs: CopyJob[];
  try {
    jobs = await collectCopyJobs(plan);
  } catch (error) {
    console.error("Error listing objects to move:", error);
    return { success: false, error: "No se pudo leer el contenido de la carpeta." };
  }

  if (plan.items.length === 0 && jobs.length === 0) {
    return { success: true };
  }

  const copied: StorageReference[] = [];
  const updates: MoveCommitUpdate[] = [];
  const total = jobs.length;
  onProgress?.({ done: 0, total });

  try {
    for (const [index, job] of jobs.entries()) {
      onProgress?.({ done: index, total, current: job.sourceRef.name });
      const blob = await getBlob(job.sourceRef);
      const destinationRef = ref(storage, job.destinationPath);
      await uploadBytes(
        destinationRef,
        blob,
        blob.type ? { contentType: blob.type } : undefined
      );
      copied.push(destinationRef);
      if (job.id) {
        updates.push({ id: job.id, download_url: await getDownloadURL(destinationRef) });
      }
    }
    onProgress?.({ done: total, total });
  } catch (error) {
    console.error("Error copying objects to move:", error);
    await deleteStorageObjects(copied, "DOCUMENT-LIBRARY-MOVE-ROLLBACK");
    return {
      success: false,
      error: "No se pudo copiar alguno de los archivos. No se ha movido nada.",
    };
  }

  const committed = await commitDocumentLibraryMove({
    organizationId,
    request,
    updates,
  });
  if (!committed.success) {
    await deleteStorageObjects(copied, "DOCUMENT-LIBRARY-MOVE-ROLLBACK");
    return committed;
  }

  // La BD ya apunta al destino: el origen sobra (si falla, sólo queda basura)
  await deleteStorageObjects(
    jobs.map((job) => job.sourceRef),
    "DOCUMENT-LIBRARY-MOVE-CLEANUP"
  );

  return { success: true };
}

export function moveDocumentLibraryFiles(
  params: { organizationId: string; fileIds: string[]; destinationFolder: string },
  onProgress?: (progress: MoveProgress) => void
) {
  return moveDocumentLibrary(
    params.organizationId,
    {
      kind: "files",
      file_ids: params.fileIds,
      destination_folder: params.destinationFolder,
    },
    onProgress
  );
}

export function moveDocumentLibraryFolder(
  params: {
    organizationId: string;
    folderPath: string;
    destinationParent?: string;
    newName?: string;
  },
  onProgress?: (progress: MoveProgress) => void
) {
  return moveDocumentLibrary(
    params.organizationId,
    {
      kind: "folder",
      folder_path: params.folderPath,
      destination_parent: params.destinationParent,
      new_name: params.newName,
    },
    onProgress
  );
}
