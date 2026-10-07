/**
 * Exporta facturas de Beenergy para el conjunto de prueba.
 *
 *   pnpm golden:export [--out <carpeta>] [--count 20] [--candidates 80]
 *
 * Solo lee de la base de Beenergy (una consulta con LIMIT) y descarga los PDF
 * a una carpeta local fuera del repositorio. Descarta las facturas sin texto
 * (escaneadas), las que no son 2.0TD y las que no se pueden anonimizar sin
 * restos. Nunca imprime nombres de fichero: algunos llevan el del cliente.
 */
import { createClient } from "@libsql/client";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { redactInvoiceText } from "@/comparador/redaction/redact";
import {
  DEFAULT_GOLDEN_DIR,
  ensureGoldenDirs,
  goldenPath,
  loadLocalEnv,
  readOption,
} from "./paths";
import { detectSupplier } from "./suppliers";

const run = promisify(execFile);

async function pdfToText(path: string): Promise<string> {
  const { stdout } = await run("pdftotext", ["-enc", "UTF-8", path, "-"], {
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const root = readOption(argv, "--out") ?? DEFAULT_GOLDEN_DIR;
  const count = Number(readOption(argv, "--count") ?? 20);
  const candidates = Number(readOption(argv, "--candidates") ?? 80);
  const perSupplierCap = Math.max(2, Math.ceil(count / 5));

  const url = process.env.NEXT_TURSO_DB_URL_BEENERGY;
  const authToken = process.env.NEXT_TURSO_DB_AUTH_TOKEN_BEENERGY;
  if (!url || !authToken) throw new Error("Faltan las credenciales de Beenergy");

  // Recorre por rowid descendente: la consulta se detiene al llegar al LIMIT.
  const db = createClient({ url, authToken });
  const { rows } = await db.execute({
    sql: `SELECT f.id, f.download_url
      FROM comparativa_files f
      JOIN comparativas c ON c.id = f.comparativa_id
      WHERE c.service = 'Luz'
        AND lower(f.extension) = 'pdf'
        AND f.filename NOT LIKE 'estudio%'
        AND f.filename NOT LIKE 'Comparativa%'
        AND f.size < 5000000
      ORDER BY f.rowid DESC
      LIMIT ?`,
    args: [candidates],
  });

  await ensureGoldenDirs(root);
  const workDir = await mkdtemp(join(tmpdir(), "golden-export-"));
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  const bySupplier: Record<string, number> = {};
  let selected = 0;

  try {
    for (const row of rows) {
      if (selected >= count) break;

      const fileId = String(row.id);
      const caseId = createHash("sha256").update(fileId).digest("hex").slice(0, 10);
      const pdfPath = join(workDir, `${caseId}.pdf`);

      const response = await fetch(String(row.download_url));
      if (!response.ok) {
        skip("descarga fallida");
        continue;
      }
      await writeFile(pdfPath, new Uint8Array(await response.arrayBuffer()));

      const text = await pdfToText(pdfPath).catch(() => "");
      if (text.replace(/\s/g, "").length < 500) {
        skip("sin texto (escaneada)");
        continue;
      }
      if (!/2\.0\s?TD/i.test(text)) {
        skip("no es 2.0TD");
        continue;
      }

      const supplier = detectSupplier(text);
      if ((bySupplier[supplier] ?? 0) >= perSupplierCap) {
        skip("cupo de comercializadora lleno");
        continue;
      }

      const redaction = redactInvoiceText(text);
      if (redaction.leaks.length > 0) {
        skip("anonimizado con restos");
        continue;
      }

      await writeFile(goldenPath(root, "originals", `${caseId}.pdf`), await readFile(pdfPath));
      await writeFile(goldenPath(root, "redacted", `${caseId}.txt`), redaction.text);
      await writeFile(
        goldenPath(root, "private", `${caseId}.json`),
        JSON.stringify(
          {
            fileId,
            cups: redaction.identifiers.cups,
            taxIds: redaction.identifiers.taxId,
            holderTokens: redaction.holderTokens,
          },
          null,
          2,
        ),
      );
      await writeFile(
        goldenPath(root, "meta", `${caseId}.json`),
        JSON.stringify(
          {
            supplierGuess: supplier,
            keptLines: redaction.keptLines,
            droppedLines: redaction.droppedLines,
            suspiciousLines: redaction.suspiciousLines,
            cupsFound: redaction.identifiers.cups.length,
          },
          null,
          2,
        ),
      );
      await writeFile(
        goldenPath(root, "review", `${caseId}.json`),
        JSON.stringify({ redactionApproved: null, confirmedFields: [] }, null, 2),
      );

      bySupplier[supplier] = (bySupplier[supplier] ?? 0) + 1;
      selected += 1;
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  console.log(`Seleccionadas ${selected} de ${rows.length} candidatas en ${root}`);
  console.log("Por comercializadora:", bySupplier);
  console.log("Descartadas:", skipped);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
