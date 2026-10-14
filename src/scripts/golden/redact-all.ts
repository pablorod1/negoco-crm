/**
 * Vuelve a anonimizar los PDF ya exportados, tras cambiar las reglas.
 *
 *   pnpm golden:redact [--dir <carpeta>]
 *
 * Todo en local. Conserva las fichas y el estado de revisión, y deja de nuevo
 * pendiente de aprobar el anonimizado de cada factura cuyo texto cambie.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { redactInvoiceForStudy } from "@/comparador/redaction/study-redaction";
import { invoiceTextFromPdf } from "@/comparador/study/invoice-text";
import { DEFAULT_GOLDEN_DIR, goldenPath, readOption } from "./paths";
import { detectSupplier } from "./suppliers";

async function main() {
  const root = readOption(process.argv.slice(2), "--dir") ?? DEFAULT_GOLDEN_DIR;
  const ids = (await readdir(goldenPath(root, "originals", "")))
    .filter((file) => file.endsWith(".pdf"))
    .map((file) => file.slice(0, -4));

  for (const id of ids) {
    // El mismo texto y el mismo anonimizado que producción.
    const { text } = await invoiceTextFromPdf(await readFile(goldenPath(root, "originals", `${id}.pdf`)));
    if (!text) {
      console.log(`${id} · sin texto (escaneada)`);
      continue;
    }
    const { redaction } = redactInvoiceForStudy(text);
    const redactedPath = goldenPath(root, "redacted", `${id}.txt`);
    const previous = await readFile(redactedPath, "utf8").catch(() => null);

    await writeFile(redactedPath, redaction.text);
    await writeFile(
      goldenPath(root, "private", `${id}.json`),
      JSON.stringify(
        {
          ...JSON.parse(
            await readFile(goldenPath(root, "private", `${id}.json`), "utf8").catch(() => "{}"),
          ),
          cups: redaction.identifiers.cups,
          taxIds: redaction.identifiers.taxId,
          holderTokens: redaction.holderTokens,
        },
        null,
        2,
      ),
    );
    await writeFile(
      goldenPath(root, "meta", `${id}.json`),
      JSON.stringify(
        {
          supplierGuess: detectSupplier(text),
          keptLines: redaction.keptLines,
          droppedLines: redaction.droppedLines,
          suspiciousLines: redaction.suspiciousLines,
          cupsFound: redaction.identifiers.cups.length,
        },
        null,
        2,
      ),
    );

    if (previous !== redaction.text) {
      const reviewPath = goldenPath(root, "review", `${id}.json`);
      const review = JSON.parse(await readFile(reviewPath, "utf8").catch(() => "{}"));
      await writeFile(
        reviewPath,
        JSON.stringify({ confirmedFields: [], ...review, redactionApproved: null }, null, 2),
      );
    }

    console.log(
      `${id} · líneas ${redaction.keptLines} · sospechosas ${redaction.suspiciousLines} · restos ${redaction.leaks.length ? redaction.leaks.join(",") : "ninguno"}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
