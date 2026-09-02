import type { Client } from "@libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAiStudiesCapability } from "@/core/access-control/capabilities";
import { getEffectivePermission } from "@/core/access-control/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

const SafePathIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const AbarcaLoginRequestSchema = z.strictObject({
  comparativa_id: SafePathIdSchema,
  file_id: SafePathIdSchema.optional(),
});

const ALLOWED_STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);
// Las facturas escaneadas se salen de lo que cabía en 15MB. De los 7.078 PDF
// que hay hoy en la base solo uno queda fuera de este tope, y a Abarca le
// llegarían ~33MB de base64 en el peor caso.
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PDF_DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_LOGIN_RESPONSE_BYTES = 64 * 1024;
const ABARCA_LOGIN_TIMEOUT_MS = 10_000;

function isAllowedAbarcaLoginUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.port === "" || url.port === "443") &&
      (url.hostname === "abarcaia.com" ||
        url.hostname.endsWith(".abarcaia.com"))
    );
  } catch {
    return false;
  }
}

const AbarcaLoginResponseSchema = z.object({
  login_url: z.string().min(1).refine(isAllowedAbarcaLoginUrl),
});

async function getAccessibleComparison(
  client: Client,
  comparisonId: string,
  user: { id: string; role: string },
) {
  const args = [comparisonId];
  let sql = "SELECT id, status FROM comparativas WHERE id = ?";

  if (user.role === "2") {
    const subcomerciales = await getSubcomerciales(client, user.id);
    const allowedUserIds = [user.id];

    if (subcomerciales.success) {
      allowedUserIds.push(...subcomerciales.ids);
    }

    sql += ` AND user_id IN (${allowedUserIds.map(() => "?").join(", ")})`;
    args.push(...allowedUserIds);
  } else if (user.role !== "admin" && user.role !== "1") {
    return undefined;
  }

  const response = await client.execute({ sql, args });
  return response.rows[0];
}

async function getComparisonFile(
  client: Client,
  fileId: string,
  comparisonId: string,
) {
  const response = await client.execute({
    sql: "SELECT download_url, extension FROM comparativa_files WHERE id = ? AND comparativa_id = ?",
    args: [fileId, comparisonId],
  });
  return response.rows[0];
}

function getAllowedStorageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !ALLOWED_STORAGE_HOSTS.has(url.hostname) ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Fallo de descarga con un motivo que se le puede enseñar al comercial.
 *
 * Antes todo acababa en un 502 con "No se pudo conectar con el comparador",
 * que es mentira cuando el problema es el fichero, y en el log no quedaba ni
 * el tamaño ni la cabecera que lo había provocado.
 */
class PdfDownloadError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, logMessage: string) {
    super(logMessage);
    this.name = "PdfDownloadError";
    this.userMessage = userMessage;
  }
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tooLargeError(bytes: number): PdfDownloadError {
  return new PdfDownloadError(
    `El PDF ocupa ${formatMegabytes(bytes)} y el máximo son ${formatMegabytes(
      MAX_PDF_BYTES,
    )}. Súbelo comprimido o elige otro archivo.`,
    `PDF exceeds size limit: ${bytes} bytes`,
  );
}

async function downloadPdfAsBase64(downloadUrl: string): Promise<string> {
  const url = getAllowedStorageUrl(downloadUrl);
  if (!url) {
    throw new Error("Unsafe PDF download URL");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PDF_DOWNLOAD_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url.toString(), {
      redirect: "manual",
      signal: controller.signal,
    });
    if (
      (response.status >= 300 && response.status < 400) ||
      !response.ok
    ) {
      throw new Error("PDF download failed");
    }

    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/pdf") {
      throw new PdfDownloadError(
        "El archivo guardado no es un PDF. Vuelve a subirlo o elige otro.",
        `Invalid PDF content type: ${contentType ?? "(sin cabecera)"}`,
      );
    }

    // La cabecera solo sirve para rechazar pronto lo que no cabe. Que no se
    // pueda interpretar no dice nada del fichero, y tratarla como error es lo
    // que devolvía 502 en producción sin dejar rastro del valor recibido: el
    // tope de verdad lo aplica el contador de bytes del bucle de abajo.
    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
        console.warn("[abarca-login] unusable content-length header", {
          contentLength: contentLengthHeader,
          url: url.pathname,
        });
      } else if (contentLength > MAX_PDF_BYTES) {
        throw tooLargeError(contentLength);
      }
    }

    if (!response.body) {
      throw new Error("PDF response has no body");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_PDF_BYTES) {
        await reader.cancel();
        throw tooLargeError(totalBytes);
      }
      chunks.push(value);
    }

    const pdf = Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk)),
      totalBytes,
    );
    if (
      totalBytes === 0 ||
      pdf
        .subarray(0, Math.min(1024, pdf.byteLength))
        .indexOf(Buffer.from("%PDF-")) === -1
    ) {
      throw new PdfDownloadError(
        "El archivo guardado no es un PDF válido. Vuelve a subirlo o elige otro.",
        `Invalid PDF signature: ${totalBytes} bytes`,
      );
    }

    return pdf.toString("base64");
  } finally {
    clearTimeout(timeout);
  }
}

class InvalidComparatorResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidComparatorResponseError";
  }
}

async function readLoginResponseText(response: Response): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_LOGIN_RESPONSE_BYTES
    ) {
      throw new InvalidComparatorResponseError(
        "Invalid comparator response content length",
      );
    }
  }

  if (!response.body) {
    throw new InvalidComparatorResponseError(
      "Comparator response has no body",
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_LOGIN_RESPONSE_BYTES) {
      await reader.cancel();
      throw new InvalidComparatorResponseError(
        "Comparator response exceeds size limit",
      );
    }
    chunks.push(value);
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  ).toString("utf8");
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateUserSession(req);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validation = AbarcaLoginRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const client = getTursoClient(req);
    if (!client) {
      console.error("[abarca-login] database client not initialized");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const hasPermission = await getEffectivePermission(
      client,
      authResult.user,
      "comparisons.study.complete",
    );
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { comparativa_id: comparisonId, file_id: fileId } = validation.data;
    const comparison = await getAccessibleComparison(
      client,
      comparisonId,
      authResult.user,
    );
    if (!comparison) {
      return NextResponse.json(
        { error: "Comparativa no encontrada" },
        { status: 404 },
      );
    }
    if (
      !["pending", "processing"].includes(String(comparison.status))
    ) {
      return NextResponse.json(
        { error: "La comparativa ya no está pendiente" },
        { status: 409 },
      );
    }

    const integrationResponse = await client.execute(
      authResult.user.role === "2"
        ? {
            sql: `SELECT abarca_user_id
              FROM user
              WHERE id = ?
              LIMIT 1`,
            args: [authResult.user.id],
          }
        : {
            sql: `SELECT o.abarca_user_id
              FROM member m
              INNER JOIN organization o ON m.organization_id = o.id
              WHERE m.user_id = ?
              LIMIT 1`,
            args: [authResult.user.id],
          },
    );
    const integrationValue = integrationResponse.rows[0]?.abarca_user_id;
    if (!hasAiStudiesCapability(integrationValue)) {
      return NextResponse.json(
        { error: "Integración de IA no configurada" },
        { status: 409 },
      );
    }
    const abarcaUserId = Number(integrationValue);

    let downloadUrl: string | undefined;
    if (fileId) {
      const file = await getComparisonFile(client, fileId, comparisonId);

      if (!file) {
        return NextResponse.json(
          { error: "Archivo no encontrado" },
          { status: 404 },
        );
      }
      if (String(file.extension).toLowerCase() !== "pdf") {
        return NextResponse.json(
          { error: "El archivo seleccionado no es PDF" },
          { status: 400 },
        );
      }

      downloadUrl =
        typeof file.download_url === "string"
          ? file.download_url
          : String(file.download_url ?? "");
      if (!downloadUrl) {
        return NextResponse.json(
          { error: "No se pudo descargar el archivo" },
          { status: 502 },
        );
      }
    }

    const { ABARCA_API_KEY: apiKey, ABARCA_TOKEN: token } = process.env;
    if (!apiKey || !token) {
      console.error("[abarca-login] required integration environment missing");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    let pdfBase64: string | undefined;
    if (downloadUrl) {
      try {
        pdfBase64 = await downloadPdfAsBase64(downloadUrl);
      } catch (error) {
        // Con el id del fichero se puede ir a mirar cuál falló; antes el log
        // no decía de qué comparativa ni de qué archivo hablaba.
        console.error("[abarca-login] PDF download failed", {
          comparisonId,
          error: error instanceof Error ? error.message : error,
          fileId,
        });
        return NextResponse.json(
          {
            error:
              error instanceof PdfDownloadError
                ? error.userMessage
                : "No se pudo descargar el archivo",
          },
          { status: 502 },
        );
      }
    }

    const stillHasPermission = await getEffectivePermission(
      client,
      authResult.user,
      "comparisons.study.complete",
    );
    if (!stillHasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const latestComparison = await getAccessibleComparison(
      client,
      comparisonId,
      authResult.user,
    );
    if (!latestComparison) {
      return NextResponse.json(
        { error: "Comparativa no encontrada" },
        { status: 404 },
      );
    }
    if (
      !["pending", "processing"].includes(String(latestComparison.status))
    ) {
      return NextResponse.json(
        { error: "La comparativa ya no está pendiente" },
        { status: 409 },
      );
    }

    if (fileId) {
      const latestFile = await getComparisonFile(
        client,
        fileId,
        comparisonId,
      );
      if (!latestFile) {
        return NextResponse.json(
          { error: "Archivo no encontrado" },
          { status: 404 },
        );
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      ABARCA_LOGIN_TIMEOUT_MS,
    );
    let upstreamText: string;
    try {
      const upstreamResponse = await fetch(
        "https://abarcaia.com/comparar/api/generate-login-token",
        {
          method: "POST",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            ide: 100,
            idcm: abarcaUserId,
            clave: token,
            comparativa_id: comparisonId,
            ...(pdfBase64 !== undefined
              ? { pdf_base64: pdfBase64 }
              : {}),
          }),
        },
      );
      if (
        (upstreamResponse.status >= 300 &&
          upstreamResponse.status < 400) ||
        !upstreamResponse.ok
      ) {
        return NextResponse.json(
          { error: "No se pudo conectar con el comparador" },
          { status: 502 },
        );
      }
      upstreamText = await readLoginResponseText(upstreamResponse);
    } catch (error) {
      if (error instanceof InvalidComparatorResponseError) {
        return NextResponse.json(
          { error: "Respuesta inválida del comparador" },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: "No se pudo conectar con el comparador" },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }

    let upstreamData: unknown;
    try {
      upstreamData = JSON.parse(upstreamText);
    } catch {
      return NextResponse.json(
        { error: "Respuesta inválida del comparador" },
        { status: 502 },
      );
    }

    const parsedResponse = AbarcaLoginResponseSchema.safeParse(upstreamData);
    if (!parsedResponse.success) {
      return NextResponse.json(
        { error: "Respuesta inválida del comparador" },
        { status: 502 },
      );
    }

    return NextResponse.json({ loginUrl: parsedResponse.data.login_url });
  } catch (error) {
    console.error("[abarca-login] unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
