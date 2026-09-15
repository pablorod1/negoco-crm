import type {
  MoveCommitUpdate,
  MovePlan,
  MoveRequest,
} from "./move-types";

export interface DocumentLibraryMutationResult {
  success: boolean;
  error?: string;
  /** Nombres que chocan en el destino (409): no se ha movido nada. */
  conflicts?: string[];
}

async function send<T extends DocumentLibraryMutationResult>(
  url: string,
  method: "POST" | "DELETE",
  body: Record<string, unknown>
): Promise<T> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as T;
    return { ...result, success: Boolean(result.success) };
  } catch (error) {
    console.error(`Error calling ${method} ${url}:`, error);
    return { success: false, error: "Inténtalo de nuevo más tarde." } as T;
  }
}

export function planDocumentLibraryMove(params: {
  organizationId: string;
  request: MoveRequest;
}) {
  return send<DocumentLibraryMutationResult & { plan?: MovePlan }>(
    "/api/v2/document-library/move/plan",
    "POST",
    { organization_id: params.organizationId, request: params.request }
  );
}

export function commitDocumentLibraryMove(params: {
  organizationId: string;
  request: MoveRequest;
  updates: MoveCommitUpdate[];
}) {
  return send("/api/v2/document-library/move/commit", "POST", {
    organization_id: params.organizationId,
    request: params.request,
    updates: params.updates,
  });
}

export function deleteDocumentLibraryFolder(params: {
  organizationId: string;
  folderPath: string;
}) {
  return send("/api/v2/document-library/folders", "DELETE", {
    organization_id: params.organizationId,
    folder_path: params.folderPath,
  });
}

/** Texto para el toast de error, con los conflictos si los hay. */
export function describeMutationError(
  result: DocumentLibraryMutationResult,
  fallback: string
): string {
  const base = result.error || fallback;
  return result.conflicts && result.conflicts.length > 0
    ? `${base} ${result.conflicts.join(", ")}`
    : base;
}
