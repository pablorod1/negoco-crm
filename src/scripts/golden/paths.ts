import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Carpeta del conjunto de prueba, fuera del repositorio. Las facturas
 * originales y los identificadores no salen nunca de este equipo.
 */
export const DEFAULT_GOLDEN_DIR = join(homedir(), "negoco-golden", "piloto");

export const GOLDEN_SUBDIRS = {
  /** PDF originales. Solo los abre la persona que revisa. */
  originals: "originals",
  /** Texto anonimizado: lo único que puede leer la IA. */
  redacted: "redacted",
  /** Identificadores leídos en local (CUPS, NIF). Nunca se envían. */
  private: "private",
  /** Estadísticas del anonimizado, sin datos personales. */
  meta: "meta",
  /** Fichas: los datos correctos de cada factura. */
  fichas: "fichas",
  /** Estado de la revisión humana. */
  review: "review",
  /** Resultado del contraste con el SIPS, sin identificadores. */
  sips: "sips",
} as const;

export type GoldenSubdir = keyof typeof GOLDEN_SUBDIRS;

export function goldenPath(root: string, subdir: GoldenSubdir, file: string) {
  return join(root, GOLDEN_SUBDIRS[subdir], file);
}

export async function ensureGoldenDirs(root: string) {
  for (const subdir of Object.values(GOLDEN_SUBDIRS)) {
    await mkdir(join(root, subdir), { recursive: true });
  }
}

export function readOption(argv: readonly string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function loadLocalEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Las variables pueden venir del entorno.
  }
}
