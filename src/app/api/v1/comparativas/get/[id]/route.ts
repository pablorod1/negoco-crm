import { ComparativaPlan } from "@/comparativas/types";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, user_id, user_role } = await req.json();

    if (!id || !user_id || !user_role) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Primero obtenemos la comparativa y el usuario
    const queryParams: (string | number)[] = [id];
    let comparativaQuery = `
      SELECT c.*, u.*
      FROM comparativas c
      INNER JOIN user u ON c.user_id = u.id
      WHERE c.id = ?
    `;

    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      const idsToInclude = [user_id];

      if (subcomerciales.success && subcomerciales.ids) {
        idsToInclude.push(...subcomerciales.ids);
      }

      comparativaQuery += ` AND u.id IN (${idsToInclude
        .map(() => "?")
        .join(", ")})`;
      queryParams.push(...idsToInclude);
    }

    const comparativaResponse = await tursoClient.execute({
      sql: comparativaQuery,
      args: queryParams,
    });

    if (comparativaResponse.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comparativa not found" },
        { status: 404 }
      );
    }

    const comparativa = comparativaResponse.rows[0];

    // Ahora obtenemos los archivos por separado
    const filesQuery = `
      SELECT * FROM comparativa_files 
      WHERE comparativa_id = ?
    `;

    const filesResponse = await tursoClient.execute({
      sql: filesQuery,
      args: [id],
    });

    // Solo procesamos los archivos si existen resultados
    const files =
      filesResponse.rows.length > 0
        ? filesResponse.rows.map((row) => ({
            id: String(row.id),
            filename: String(row.filename),
            size: Number(row.size),
            extension: String(row.extension),
            upload_date: row.upload_date as string,
            download_url: String(row.download_url),
            preview_url: row.preview_url ? String(row.preview_url) : null,
          }))
        : [];

    return NextResponse.json({
      success: true,
      data: {
        id: String(comparativa.id),
        client: String(comparativa.client),
        service: String(comparativa.service),
        plan: JSON.parse(comparativa.plan as string) as ComparativaPlan[],
        status: String(comparativa.status),
        comision: {
          fijo: Number(comparativa.comision_fijo),
          indexado: Number(comparativa.comision_indexado),
        },
        comision_sales_person: {
          fijo: Number(comparativa.comision_sales_person_fijo),
          indexado: Number(comparativa.comision_sales_person_indexado),
        },
        notes: JSON.parse(comparativa.notes as string) as string[],
        user: {
          id: String(comparativa.user_id),
          email: String(comparativa.email),
          name: String(comparativa.name),
          image: comparativa.image ? String(comparativa.image) : null,
        },
        creation_date: comparativa.creation_date as string,
        tramite_id: comparativa.tramite_id
          ? String(comparativa.tramite_id)
          : null,
        files,
      },
    });
  } catch (error) {
    console.error("Error getting comparativa:", error);
    return NextResponse.json(
      { success: false, error: "Error getting comparativa" },
      { status: 500 }
    );
  }
}
