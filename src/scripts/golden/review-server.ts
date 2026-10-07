/**
 * Página local para revisar el conjunto de prueba.
 *
 *   pnpm golden:review [--dir <carpeta>] [--port 4310]
 *
 * Solo escucha en 127.0.0.1. Muestra la factura original junto a su texto
 * anonimizado (para aprobar el anonimizado) y junto a su ficha (para confirmar
 * o corregir los campos que no se han podido verificar solos).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { InvoiceExtractionSchema } from "@/comparador/extraction/invoice-schema";
import { validateInvoice } from "@/comparador/extraction/validate";
import { DEFAULT_GOLDEN_DIR, goldenPath, readOption } from "./paths";
import { REVIEW_PAGE } from "./review-page";
import { computeFieldStatuses, type SipsCheck } from "./statuses";

const argv = process.argv.slice(2);
const root = readOption(argv, "--dir") ?? DEFAULT_GOLDEN_DIR;
const port = Number(readOption(argv, "--port") ?? 4310);
const CASE_ID = /^[a-f0-9]{10}$/;

interface ReviewState {
  redactionApproved: boolean | null;
  confirmedFields: string[];
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function caseIds(): Promise<string[]> {
  const files = await readdir(goldenPath(root, "redacted", ""));
  return files
    .filter((file) => file.endsWith(".txt"))
    .map((file) => file.slice(0, -4))
    .filter((id) => CASE_ID.test(id))
    .sort();
}

async function loadCase(id: string) {
  const [meta, review, ficha, privateData, sips, redactedText] = await Promise.all([
    readJson<{ supplierGuess: string; suspiciousLines: number; keptLines: number; droppedLines: number }>(
      goldenPath(root, "meta", `${id}.json`),
    ),
    readJson<ReviewState>(goldenPath(root, "review", `${id}.json`)),
    readJson<unknown>(goldenPath(root, "fichas", `${id}.json`)),
    readJson<{ cups: string[]; taxIds: string[] }>(goldenPath(root, "private", `${id}.json`)),
    readJson<SipsCheck>(goldenPath(root, "sips", `${id}.json`)),
    readFile(goldenPath(root, "redacted", `${id}.txt`), "utf8"),
  ]);

  const parsed = ficha ? InvoiceExtractionSchema.safeParse(ficha) : null;
  const state = review ?? { redactionApproved: null, confirmedFields: [] };
  const statuses =
    parsed?.success && meta
      ? computeFieldStatuses({
          ficha: parsed.data,
          redactedText,
          supplierGuess: meta.supplierGuess,
          privateCups: privateData?.cups ?? [],
          sips,
          confirmedFields: state.confirmedFields,
        })
      : null;

  return {
    id,
    meta,
    review: state,
    redactedText,
    ficha: parsed?.success ? parsed.data : ficha,
    fichaErrors: parsed && !parsed.success ? parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) : [],
    statuses,
    issues: parsed?.success ? validateInvoice({ ...parsed.data, cups: privateData?.cups[0] ?? null }) : [],
    private: privateData,
    sips,
  };
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(response: ServerResponse, status: number, body: unknown, type = "application/json") {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(type === "application/json" ? JSON.stringify(body) : (body as string | Buffer));
}

async function saveReview(id: string, update: (state: ReviewState) => ReviewState) {
  const path = goldenPath(root, "review", `${id}.json`);
  const current = (await readJson<ReviewState>(path)) ?? {
    redactionApproved: null,
    confirmedFields: [],
  };
  await writeFile(path, JSON.stringify(update(current), null, 2));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const [, scope, id, action] = url.pathname.split("/");

    if (url.pathname === "/") return send(response, 200, REVIEW_PAGE, "text/html; charset=utf-8");

    if (scope === "pdf" && id && CASE_ID.test(id)) {
      const pdf = await readFile(goldenPath(root, "originals", `${id}.pdf`));
      return send(response, 200, pdf, "application/pdf");
    }

    if (url.pathname === "/api/cases") {
      const cases = await Promise.all((await caseIds()).map(loadCase));
      return send(
        response,
        200,
        cases.map(({ id: caseId, meta, review, ficha, statuses }) => ({
          id: caseId,
          supplierGuess: meta?.supplierGuess ?? "otra",
          redactionApproved: review.redactionApproved,
          hasFicha: Boolean(ficha),
          pending: statuses
            ? Object.values(statuses).filter((s) => s === "unverified" || s === "error").length
            : null,
        })),
      );
    }

    if (scope === "api" && id === "cases") {
      const caseId = action;
      if (!caseId || !CASE_ID.test(caseId)) return send(response, 404, { error: "not found" });
      const operation = url.pathname.split("/")[4];

      if (request.method === "GET" && !operation) return send(response, 200, await loadCase(caseId));

      if (request.method === "POST" && operation === "redaction") {
        const { approved } = (await readBody(request)) as { approved: boolean | null };
        await saveReview(caseId, (state) => ({ ...state, redactionApproved: approved }));
        return send(response, 200, await loadCase(caseId));
      }

      if (request.method === "POST" && operation === "confirm") {
        const { field, confirmed } = (await readBody(request)) as { field: string; confirmed: boolean };
        await saveReview(caseId, (state) => ({
          ...state,
          confirmedFields: confirmed
            ? [...new Set([...state.confirmedFields, field])]
            : state.confirmedFields.filter((item) => item !== field),
        }));
        return send(response, 200, await loadCase(caseId));
      }

      if (request.method === "PUT" && operation === "ficha") {
        const { ficha } = (await readBody(request)) as { ficha: unknown };
        const parsed = InvoiceExtractionSchema.safeParse(ficha);
        if (!parsed.success) {
          return send(response, 400, {
            errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
        }
        await writeFile(goldenPath(root, "fichas", `${caseId}.json`), JSON.stringify(parsed.data, null, 2));
        return send(response, 200, await loadCase(caseId));
      }
    }

    send(response, 404, { error: "not found" });
  } catch (error) {
    console.error(error);
    send(response, 500, { error: error instanceof Error ? error.message : "error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Revisión del conjunto de prueba: http://127.0.0.1:${port}  (${root})`);
});
