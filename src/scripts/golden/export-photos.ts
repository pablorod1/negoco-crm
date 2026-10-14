/**
 * Exporta fotos de facturas de Beenergy para medir el OCR con imágenes reales.
 *
 *   pnpm golden:photos [--out <carpeta>] [--count 30] [--candidates 400]
 *
 * Toma las imágenes de comparativas de luz y, de los trámites, solo las que
 * se llaman «factura» (los trámites guardan también DNI y contratos). Cada
 * subida (mismo expediente y minuto) es una factura de una o varias fotos.
 * La lee igual que producción (`readInvoice`: OCR local y los mismos topes) y
 * la anonimiza igual. Descarta en local lo que no es una factura de luz 2.0TD
 * sin guardarlo. Nunca imprime nombres de fichero: llevan el del cliente.
 */
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { clientFromInvoiceText } from "@/comparador/redaction/invoice-client";
import { redactInvoiceText } from "@/comparador/redaction/redact";
import { readInvoice } from "@/comparador/study/read-invoice";
import { StudyError } from "@/comparador/study/errors";
import { ensureGoldenDirs, goldenPath, loadLocalEnv, readOption } from "./paths";
import { detectSupplier } from "./suppliers";

const DEFAULT_PHOTOS_DIR = join(process.env.HOME ?? "", "negoco-golden", "fotos");
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "heic", "heif", "webp"];
/** Nombres que no son facturas aunque estén en el expediente. */
const NOT_INVOICE_NAME = ["dni", "nie", "dorso", "anverso", "reverso", "contrato", "cif", "escritura", "pasaporte"];
/** Una foto de factura de luz trae consumos en kWh y algo de potencia o peajes. */
const LOOKS_LIKE_INVOICE = (text: string) =>
  /kwh/i.test(text) && /(potencia|peaje)/i.test(text) && /(factura|importe|total)/i.test(text);
const OTHER_ACCESS_TARIFF = /\b[36][.,][01]\s?T\.?D\b/i;
/** Gas, solo o junto a la de luz en la misma subida: no sirve para medir una factura de luz. */
const HAS_GAS = /factura de gas|consumo gas|t[ée]rmino energ[íi]a gas|gas natural|\bRL\.?[1-4]\b/i;
const MAX_PAGES = 4;

interface Row {
  owner: string;
  batch: string;
  url: string;
  extension: string;
  position: number;
}

function imageFilter(column: string) {
  const extensions = IMAGE_EXTENSIONS.map((extension) => `'${extension}'`).join(",");
  const names = NOT_INVOICE_NAME.map((word) => `lower(${column}.filename) NOT LIKE '%${word}%'`).join(" AND ");
  return `lower(${column}.extension) IN (${extensions}) AND ${names}`;
}

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const root = readOption(argv, "--out") ?? DEFAULT_PHOTOS_DIR;
  const count = Number(readOption(argv, "--count") ?? 30);
  const candidates = Number(readOption(argv, "--candidates") ?? 400);

  const url = process.env.NEXT_TURSO_DB_URL_BEENERGY;
  const authToken = process.env.NEXT_TURSO_DB_AUTH_TOKEN_BEENERGY;
  if (!url || !authToken) throw new Error("Faltan las credenciales de Beenergy");

  const db = createClient({ url, authToken });
  const { rows } = await db.execute({
    sql: `SELECT * FROM (
        SELECT 'c' || f.comparativa_id AS owner, substr(f.upload_date, 1, 16) AS batch,
               f.download_url AS url, lower(f.extension) AS extension, f.rowid AS position
        FROM comparativa_files f JOIN comparativas c ON c.id = f.comparativa_id
        WHERE c.service = 'Luz' AND ${imageFilter("f")}
        UNION ALL
        SELECT 't' || f.tramite_id, substr(f.upload_date, 1, 16), f.download_url, lower(f.extension), f.rowid
        FROM tramite_files f
        WHERE lower(f.filename) LIKE '%factura%' AND ${imageFilter("f")}
      ) ORDER BY position DESC LIMIT ?`,
    args: [candidates],
  });

  // Fotos de la misma subida: una factura en varias páginas.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const item = {
      owner: String(row.owner),
      batch: String(row.batch),
      url: String(row.url),
      extension: String(row.extension),
      position: Number(row.position),
    };
    const key = `${item.owner}|${item.batch}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  await ensureGoldenDirs(root);
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  const bySupplier: Record<string, number> = {};
  let selected = 0;

  for (const [key, group] of groups) {
    if (selected >= count) break;
    // La consulta va de la más nueva a la más antigua; las páginas, en el orden en que se subieron.
    const pages = [...group].sort((left, right) => left.position - right.position);
    if (pages.length > MAX_PAGES) {
      skip("más de 4 fotos en la subida");
      continue;
    }
    const caseId = createHash("sha256").update(key).digest("hex").slice(0, 10);

    const images: Uint8Array[] = [];
    for (const page of pages) {
      // El error de fetch lleva la URL, y la URL el nombre del fichero: no se muestra.
      const response = await fetch(page.url).catch(() => null);
      if (response?.ok) images.push(new Uint8Array(await response.arrayBuffer()));
    }
    if (images.length !== pages.length) {
      skip("descarga fallida");
      continue;
    }

    let text: string;
    const started = Date.now();
    try {
      ({ text } = await readInvoice({
        data: images[0],
        mime: `image/${pages[0].extension === "jpg" ? "jpeg" : pages[0].extension}`,
        fileName: `factura.${pages[0].extension}`,
        morePages: images.slice(1),
      }));
    } catch (error) {
      // Lo que producción rechaza por ilegible también es un dato: se cuenta.
      skip(error instanceof StudyError ? "ilegible para producción" : "error de OCR");
      continue;
    }
    const ocrMs = Date.now() - started;

    if (!LOOKS_LIKE_INVOICE(text)) {
      skip("no es una factura de luz");
      continue;
    }
    if (OTHER_ACCESS_TARIFF.test(text) || HAS_GAS.test(text)) {
      skip("no es 2.0TD");
      continue;
    }

    const clientData = clientFromInvoiceText(text.replace(/\t/g, "\n"));
    const redaction = redactInvoiceText(text, {
      fromImage: true,
      knownHolderTokens: [clientData?.name, clientData?.lastName, clientData?.address]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => value.split(/\s+/)),
    });
    if (redaction.leaks.length > 0) {
      skip("anonimizado con restos");
      continue;
    }

    const supplier = detectSupplier(redaction.text);
    for (const [index, page] of pages.entries()) {
      await writeFile(goldenPath(root, "originals", `${caseId}-${index + 1}.${page.extension}`), images[index]);
    }
    await writeFile(goldenPath(root, "redacted", `${caseId}.txt`), redaction.text);
    await writeFile(
      goldenPath(root, "private", `${caseId}.json`),
      JSON.stringify(
        { source: key.split("|")[0], cups: redaction.identifiers.cups, taxIds: redaction.identifiers.taxId },
        null,
        2,
      ),
    );
    await writeFile(
      goldenPath(root, "meta", `${caseId}.json`),
      JSON.stringify(
        {
          supplierGuess: supplier,
          pages: pages.length,
          extensions: pages.map(({ extension }) => extension),
          ocrMs,
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
    console.log(`${selected}/${count} ${caseId} · ${supplier} · ${pages.length} foto(s) · ${ocrMs} ms`);
  }

  console.log(`Seleccionadas ${selected} de ${groups.size} subidas en ${root}`);
  console.log("Por comercializadora:", bySupplier);
  console.log("Descartadas:", skipped);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
