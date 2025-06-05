import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { Row } from "@libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { user_id, user_role } = await req.json();

    if (!user_id || !user_role) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    let query = `
      SELECT 
        f.*, 
        fd.id AS file_id,
        fd.fotovoltaica_id,
        fd.filename,
        fd.size,
        fd.extension,
        fd.upload_date,
        fd.download_url,
        fd.preview_url,
        u.name AS user_name,
        u.email AS user_email,
        u.image AS user_image,
        ub.name AS updated_by_name,
        ub.email AS updated_by_email,
        ub.image AS updated_by_image
      FROM fotovoltaica f
      LEFT JOIN user u ON f.user_id = u.id
      LEFT JOIN fotovoltaica_files fd ON f.id = fd.fotovoltaica_id
      LEFT JOIN user ub ON f.updated_by = ub.id
      WHERE f.id = ?
    `;

    let queryParams: string[] = [id];

    if (user_role === "2") {
      // Obtener subcomerciales si existen
      const subcomercialesRes = await getSubcomerciales(tursoClient, user_id);
      const subcomercialesIds =
        subcomercialesRes.success && subcomercialesRes.ids
          ? subcomercialesRes.ids
          : [];

      // Modificar la consulta según los permisos
      if (subcomercialesIds.length > 0) {
        // Puede acceder a sus trámites y a los de sus subcomerciales
        const placeholders = subcomercialesIds.map(() => "?").join(",");
        query += ` AND (f.user_id = ? OR f.user_id IN (${placeholders}))`;
        queryParams = [...queryParams, user_id, ...subcomercialesIds];
      } else {
        // Solo puede acceder a sus propios trámites
        query += ` AND f.user_id = ?`;
        queryParams = [...queryParams, user_id];
      }
    }
    const rs = await tursoClient.execute(query, queryParams);

    if (rs.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Fotovoltaica not found" },
        { status: 404 }
      );
    }

    // Process the results to match FotovoltaicaVM interface
    const firstRow = rs.rows[0] as Row;

    // Extract fotovoltaica base data (assuming column names match FotovoltaicaDB)
    const fotovoltaicaData = {
      id: firstRow.id,
      type: firstRow.type,
      client: firstRow.client,
      client_type: firstRow.client_type,
      location: firstRow.location,
      coordinates: firstRow.coordinates
        ? JSON.parse(firstRow.coordinates as string)
        : null,
      creation_date: firstRow.creation_date,
      activation_date: firstRow.activation_date,
      status: firstRow.status,
      notes: firstRow.notes ? JSON.parse(firstRow.notes as string) : [],
      internal_notes: firstRow.internal_notes
        ? JSON.parse(firstRow.internal_notes as string)
        : [],
      comision: firstRow.comision,
      comision_sales_person: firstRow.comision_sales_person,
      updated_at: firstRow.updated_at,
      user_id: firstRow.user_id,
    };

    // Extract user data (prefixed columns from JOIN)
    const userData = {
      id: firstRow.user_id,
      name: firstRow.user_name || null,
      email: firstRow.user_email || null,
      image: firstRow.user_image || null,
    };

    const updatedByData = {
      name: firstRow.updated_by_name || null,
      email: firstRow.updated_by_email || null,
      image: firstRow.updated_by_image || null,
    };

    // Extract and group files
    const filesMap = new Map();
    rs.rows.forEach((row: Row) => {
      if (row.filename && row.file_id) {
        // Only if file data exists and has proper file ID
        const fileId = row.file_id; // Now using the properly aliased file_id
        const fileData = {
          id: fileId,
          fotovoltaica_id: row.fotovoltaica_id,
          filename: row.filename,
          size: row.size,
          extension: row.extension,
          upload_date: row.upload_date,
          download_url: row.download_url,
          preview_url: row.preview_url,
        };
        filesMap.set(fileId, fileData);
      }
    });

    const fotovoltaicaVM = {
      ...fotovoltaicaData,
      user: userData,
      files: Array.from(filesMap.values()),
      updated_by: updatedByData, // Add logic if you have updated_by data
    };

    return NextResponse.json(
      { success: true, data: fotovoltaicaVM },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching fotovoltaica:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
