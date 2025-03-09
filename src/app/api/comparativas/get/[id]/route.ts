import { ComparativaPlan } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
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

    const queryParams: (string | number)[] = [id];
    let query = `
      SELECT c.*, u.*, cf.*
      FROM comparativas c
      INNER JOIN user u ON c.user_id = u.id
      LEFT JOIN comparativa_files cf ON c.id = cf.comparativa_id
      WHERE c.id = ?
    `;

    if (user_role === "2") {
      const subcomercialesRes = await fetch(
        `${req.nextUrl.origin}/api/users/get/subcomerciales`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: user_id }),
        }
      );
      const subcomerciales = await subcomercialesRes.json();
      const idsToInclude = [user_id];

      if (subcomerciales.success && subcomerciales.ids) {
        idsToInclude.push(...subcomerciales.ids);
      }

      query += ` AND u.id IN (${idsToInclude.map(() => "?").join(", ")})`;
      queryParams.push(...idsToInclude);
    }

    const response = await tursoClient.execute({
      sql: query,
      args: queryParams,
    });

    if (response.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comparativa not found" },
        { status: 404 }
      );
    }

    const comparativa = response.rows[0];
    const files = response.rows.map((row) => ({
      id: String(row.id),
      filename: String(row.filename),
      size: Number(row.size),
      extension: String(row.extension),
      upload_date: row.upload_date as string,
      download_url: String(row.download_url),
      preview_url: row.preview_url ? String(row.preview_url) : null,
    }));

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
        files: files,
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
