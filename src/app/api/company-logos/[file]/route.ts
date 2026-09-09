import { NextRequest } from "next/server";
import { getTursoControlClient } from "@/core/libsql/client";
import { isCompanyLogoFile } from "@/comercializadoras/lib/logo-url";

/**
 * Sirve el logo de una comercializadora desde la base de control.
 *
 * Los logos se suben desde el backoffice y se guardan en `company_logos` de
 * `negoco-crm-control`, así que dar de alta una comercializadora nueva ya no
 * obliga a commitear el fichero en `public/companies` y desplegar el CRM.
 * Las que ya estaban en el repo se siguen sirviendo desde ahí (ver
 * `companyLogoUrl`), por lo que esta ruta sólo atiende a las nuevas.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const name = decodeURIComponent(file);

  if (!isCompanyLogoFile(name)) {
    return new Response("Nombre de logo no válido", { status: 400 });
  }

  let row;
  try {
    const client = getTursoControlClient();
    const result = await client.execute({
      sql: `SELECT content_type, bytes, etag FROM company_logos WHERE file = ?`,
      args: [name],
    });
    row = result.rows[0];
  } catch (error) {
    // Sin base de control configurada o sin la tabla todavía: para el
    // navegador es indistinguible de un logo que no existe.
    console.error("Error serving company logo:", {
      file: name,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Logo no disponible", { status: 404 });
  }

  if (!row) return new Response("Logo no encontrado", { status: 404 });

  const etag = `"${String(row.etag)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return new Response(new Uint8Array(row.bytes as ArrayBuffer), {
    headers: {
      "content-type": String(row.content_type),
      etag,
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
