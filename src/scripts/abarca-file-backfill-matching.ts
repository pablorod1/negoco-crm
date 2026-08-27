export interface BackfillFileDescriptor {
  filename: string;
  size: number;
  extension: string;
}

export interface StorageObjectDescriptor {
  fullPath: string;
  name: string;
  size: number;
}

export type StorageObjectMatch =
  | { kind: "matched"; candidate: StorageObjectDescriptor }
  | { kind: "ambiguous"; candidates: StorageObjectDescriptor[] }
  | { kind: "metadata_mismatch"; candidates: StorageObjectDescriptor[] }
  | { kind: "not_found" };

function normalizedExtension(value: string): string {
  return value.trim().replace(/^\./, "").toLowerCase();
}

function extensionFromFilename(filename: string): string {
  const separatorIndex = filename.lastIndexOf(".");
  return separatorIndex === -1 ? "" : filename.slice(separatorIndex + 1);
}

export function matchStorageObject(
  file: BackfillFileDescriptor,
  objects: readonly StorageObjectDescriptor[],
): StorageObjectMatch {
  const sameLogicalName = objects.filter(
    (candidate) =>
      candidate.name === file.filename ||
      candidate.fullPath.endsWith(`/${file.filename}`),
  );
  if (sameLogicalName.length === 0) {
    return { kind: "not_found" };
  }

  const expectedExtension = normalizedExtension(file.extension);
  const exactMatches = sameLogicalName.filter(
    (candidate) =>
      candidate.size === file.size &&
      normalizedExtension(extensionFromFilename(candidate.name)) ===
        expectedExtension,
  );

  if (exactMatches.length === 1) {
    return { kind: "matched", candidate: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { kind: "ambiguous", candidates: exactMatches };
  }
  return { kind: "metadata_mismatch", candidates: sameLogicalName };
}
