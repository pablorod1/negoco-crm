import { loadEnvConfig } from "@next/env";
import type { Client } from "@libsql/client";
import {
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
  uploadBytes,
  type FirebaseStorage,
  type StorageReference,
} from "firebase/storage";
import {
  matchStorageObject,
  type StorageObjectDescriptor,
} from "./abarca-file-backfill-matching";

interface CliOptions {
  tenant: string;
  apply: boolean;
}

interface AffectedFile {
  fileId: string;
  tramiteId: string;
  comparativaId: string;
  filename: string;
  size: number;
  extension: string;
}

interface StorageObject extends StorageObjectDescriptor {
  reference: StorageReference;
}

type ResultStatus =
  | "repairable"
  | "repaired"
  | "ambiguous"
  | "metadata_mismatch"
  | "not_found"
  | "failed";

interface FileResult {
  fileId: string;
  tramiteId: string;
  comparativaId: string;
  filename: string;
  size: number;
  extension: string;
  status: ResultStatus;
  sourcePath?: string;
  destinationPath?: string;
  candidates?: Array<{ fullPath: string; size: number }>;
  error?: string;
}

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

function printHelp(): void {
  console.log(`Uso:
  pnpm backfill:abarca-files --tenant <tenant> [--apply]

Opciones:
  --tenant <tenant>  Tenant cuyas variables NEXT_TURSO_DB_* se utilizarán.
  --apply            Copia los archivos y actualiza Turso. Sin esta opción se ejecuta en dry-run.
  --help             Muestra esta ayuda.

Seguridad:
  - El dry-run es el modo predeterminado.
  - Solo se reparan coincidencias únicas por nombre, extensión y tamaño.
  - Los objetos originales de la comparativa nunca se eliminan.`);
}

function parseCliOptions(args: string[]): CliOptions | null {
  if (args.includes("--help") || args.includes("-h")) {
    return null;
  }

  let tenant: string | undefined;
  let apply = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--tenant") {
      tenant = args[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith("--tenant=")) {
      tenant = argument.slice("--tenant=".length);
      continue;
    }
    throw new Error(`Argumento desconocido: ${argument}`);
  }

  if (!tenant || !/^[a-z0-9_-]+$/i.test(tenant)) {
    throw new Error(
      "Debes indicar un tenant válido mediante --tenant <tenant>",
    );
  }

  return { tenant: tenant.toLowerCase(), apply };
}

function requiredString(value: unknown, field: string): string {
  const parsed = String(value ?? "").trim();
  if (!parsed) {
    throw new Error(`La consulta devolvió ${field} vacío`);
  }
  return parsed;
}

function parseAffectedFile(row: Record<string, unknown>): AffectedFile {
  const size = Number(row.size);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error(`El archivo ${String(row.file_id)} tiene un tamaño inválido`);
  }

  return {
    fileId: requiredString(row.file_id, "file_id"),
    tramiteId: requiredString(row.tramite_id, "tramite_id"),
    comparativaId: requiredString(row.comparativa_id, "comparativa_id"),
    filename: requiredString(row.filename, "filename"),
    size,
    extension: requiredString(row.extension, "extension"),
  };
}

async function getOrganizationId(db: Client): Promise<string> {
  const result = await db.execute("SELECT id FROM organization LIMIT 2");
  if (result.rows.length !== 1) {
    throw new Error(
      `Se esperaba exactamente una organización y se encontraron ${result.rows.length}`,
    );
  }
  return requiredString(result.rows[0].id, "organization.id");
}

async function getAffectedFiles(db: Client): Promise<AffectedFile[]> {
  const result = await db.execute({
    sql: `SELECT
        tf.id AS file_id,
        tf.tramite_id,
        tf.filename,
        tf.size,
        tf.extension,
        c.id AS comparativa_id
      FROM tramite_files tf
      INNER JOIN comparativas c ON c.tramite_id = tf.tramite_id
      WHERE TRIM(COALESCE(tf.download_url, '')) = ''
      ORDER BY c.id, tf.id`,
    args: [],
  });

  const files = result.rows.map(parseAffectedFile);
  const fileIds = new Set<string>();
  for (const file of files) {
    if (fileIds.has(file.fileId)) {
      throw new Error(
        `El archivo ${file.fileId} está relacionado con más de una comparativa`,
      );
    }
    fileIds.add(file.fileId);
  }
  return files;
}

async function listRecursively(
  folder: StorageReference,
): Promise<StorageReference[]> {
  const result = await listAll(folder);
  const nestedItems = await Promise.all(
    result.prefixes.map((prefix) => listRecursively(prefix)),
  );
  return [...result.items, ...nestedItems.flat()];
}

async function loadComparisonObjects(
  storage: FirebaseStorage,
  organizationId: string,
  comparativaId: string,
): Promise<StorageObject[]> {
  const root = ref(
    storage,
    `${organizationId}/comparativas/${comparativaId}`,
  );
  const references = await listRecursively(root);
  return Promise.all(
    references.map(async (reference) => {
      const metadata = await getMetadata(reference);
      return {
        reference,
        fullPath: reference.fullPath,
        name: reference.name,
        size: metadata.size,
      };
    }),
  );
}

function normalizeExtension(extension: string): string {
  return extension.trim().replace(/^\./, "").toLowerCase();
}

async function copyAndUpdate(
  db: Client,
  storage: FirebaseStorage,
  organizationId: string,
  file: AffectedFile,
  source: StorageObject,
): Promise<string> {
  const sourceUrl = await getDownloadURL(source.reference);
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el origen: HTTP ${response.status}`);
  }

  const destinationPath = `${organizationId}/tramites/${file.tramiteId}/${file.fileId}/${file.filename}`;
  const destination = ref(storage, destinationPath);
  await uploadBytes(destination, await response.blob());
  const destinationUrl = await getDownloadURL(destination);
  if (!destinationUrl) {
    throw new Error("Firebase no devolvió la URL del archivo copiado");
  }

  const hasImagePreview = IMAGE_EXTENSIONS.has(
    normalizeExtension(file.extension),
  );
  const update = await db.execute({
    sql: `UPDATE tramite_files
      SET
        download_url = ?,
        preview_url = CASE WHEN ? = 1 THEN ? ELSE preview_url END
      WHERE id = ?
        AND tramite_id = ?
        AND TRIM(COALESCE(download_url, '')) = ''`,
    args: [
      destinationUrl,
      hasImagePreview ? 1 : 0,
      destinationUrl,
      file.fileId,
      file.tramiteId,
    ],
  });
  if (update.rowsAffected !== 1) {
    throw new Error(
      `La actualización afectó ${update.rowsAffected} filas en lugar de 1`,
    );
  }
  return destinationPath;
}

function unresolvedResult(
  file: AffectedFile,
  match: Exclude<
    ReturnType<typeof matchStorageObject>,
    { kind: "matched" }
  >,
): FileResult {
  return {
    fileId: file.fileId,
    tramiteId: file.tramiteId,
    comparativaId: file.comparativaId,
    filename: file.filename,
    size: file.size,
    extension: file.extension,
    status: match.kind,
    ...(match.kind === "not_found"
      ? {}
      : {
          candidates: match.candidates.map(({ fullPath, size }) => ({
            fullPath,
            size,
          })),
        }),
  };
}

async function processFile(
  db: Client,
  storage: FirebaseStorage,
  organizationId: string,
  file: AffectedFile,
  objects: readonly StorageObject[],
  apply: boolean,
): Promise<FileResult> {
  const match = matchStorageObject(file, objects);
  if (match.kind !== "matched") {
    return unresolvedResult(file, match);
  }

  const result: FileResult = {
    fileId: file.fileId,
    tramiteId: file.tramiteId,
    comparativaId: file.comparativaId,
    filename: file.filename,
    size: file.size,
    extension: file.extension,
    status: apply ? "repaired" : "repairable",
    sourcePath: match.candidate.fullPath,
  };
  if (!apply) {
    return result;
  }

  const source = objects.find(
    (candidate) => candidate.fullPath === match.candidate.fullPath,
  );
  if (!source) {
    throw new Error("La referencia de Storage seleccionada ya no está disponible");
  }
  result.destinationPath = await copyAndUpdate(
    db,
    storage,
    organizationId,
    file,
    source,
  );
  return result;
}

function printResult(result: FileResult): void {
  console.log(JSON.stringify({ type: "file", ...result }));
}

function printSummary(
  tenant: string,
  apply: boolean,
  results: readonly FileResult[],
): void {
  const counts: Record<ResultStatus, number> = {
    repairable: 0,
    repaired: 0,
    ambiguous: 0,
    metadata_mismatch: 0,
    not_found: 0,
    failed: 0,
  };
  for (const result of results) {
    counts[result.status] += 1;
  }
  console.log(
    JSON.stringify({
      type: "summary",
      tenant,
      mode: apply ? "apply" : "dry-run",
      total: results.length,
      counts,
      sourceObjectsPreserved: true,
    }),
  );
}

async function run(options: CliOptions): Promise<number> {
  loadEnvConfig(process.cwd());
  const [{ getTursoClientByTenant }, { storage }] = await Promise.all([
    import("@/core/libsql/client"),
    import("@/core/firebase/firebaseConfig"),
  ]);
  const db = getTursoClientByTenant(options.tenant);

  try {
    const [organizationId, files] = await Promise.all([
      getOrganizationId(db),
      getAffectedFiles(db),
    ]);
    const objectCache = new Map<string, Promise<StorageObject[]>>();
    const results: FileResult[] = [];

    for (const file of files) {
      let objectsPromise = objectCache.get(file.comparativaId);
      if (!objectsPromise) {
        objectsPromise = loadComparisonObjects(
          storage,
          organizationId,
          file.comparativaId,
        );
        objectCache.set(file.comparativaId, objectsPromise);
      }

      try {
        const result = await processFile(
          db,
          storage,
          organizationId,
          file,
          await objectsPromise,
          options.apply,
        );
        results.push(result);
        printResult(result);
      } catch (error) {
        const result: FileResult = {
          fileId: file.fileId,
          tramiteId: file.tramiteId,
          comparativaId: file.comparativaId,
          filename: file.filename,
          size: file.size,
          extension: file.extension,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(result);
        printResult(result);
      }
    }

    printSummary(options.tenant, options.apply, results);
    if (!options.apply) {
      return 0;
    }
    return results.every((result) => result.status === "repaired") ? 0 : 2;
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  let options: CliOptions | null;
  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (!options) {
    printHelp();
    return;
  }

  try {
    process.exitCode = await run(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
