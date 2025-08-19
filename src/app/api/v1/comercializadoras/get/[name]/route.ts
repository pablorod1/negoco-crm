import { DocumentacionFile } from "@/core/types";
import { Rate } from "@/comercializadoras/types";
import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    // Single optimized query with subqueries
    const query = `
      SELECT 
        c.id,
        c.name,
        c.logo,
        c.active,
        COUNT(DISTINCT con.tramite_id) as num_tramites,
        (SELECT COUNT(*) FROM documentacion_files WHERE folder_name LIKE '%' || c.name || '%') as num_files,
        (SELECT json_group_array(
          json_object(
            'id', cr.id,
            'name', cr.name,
            'type', cr.type,
            'price', cr.price,
            'created_at', cr.created_at,
            'updated_at', cr.updated_at
          )
        ) FROM comercializadora_rates cr WHERE cr.comercializadora_id = c.id ORDER BY cr.created_at DESC) as rates,
        (SELECT json_group_array(
          json_object(
            'name', df.name,
            'extension', df.extension,
            'preview_url', df.preview_url,
            'download_url', df.download_url,
            'upload_date', df.upload_date,
            'size', df.size
          )
        ) FROM documentacion_files df WHERE df.folder_name LIKE '%' || c.name || '%') as files
      FROM comercializadoras c
      LEFT JOIN contracts con ON con.new_company = c.name
      WHERE c.name = ?
      GROUP BY c.id, c.name, c.logo, c.active
    `;

    const response = await tursoClient.execute(query, [name]);

    if (!response || response.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No comercializadora found" },
        { status: 404 }
      );
    }

    const comercializadora = response.rows[0];

    // Parse the JSON rates array
    let rates = [];
    try {
      const ratesJson = comercializadora.rates as string;
      rates = ratesJson ? JSON.parse(ratesJson) : [];
      // Filter out null entries that can occur with json_group_array
      rates = rates.filter((rate: Rate) => rate.id !== null);
    } catch (error) {
      console.error("Error parsing rates JSON:", error);
      rates = [];
    }

    // Parse the JSON files array
    let files = [];
    try {
      const filesJson = comercializadora.files as string;
      files = filesJson ? JSON.parse(filesJson) : [];
      // Filter out null entries and convert size to number
      files = files
        .filter((file: DocumentacionFile) => file.name !== null)
        .map((file: DocumentacionFile) => ({
          ...file,
          size: Number(file.size) || 0,
        }));
    } catch (error) {
      console.error("Error parsing files JSON:", error);
      files = [];
    }

    // Build the response data
    const responseData = {
      id: comercializadora.id,
      name: comercializadora.name,
      logo: comercializadora.logo,
      active: Boolean(comercializadora.active),
      rates: rates,
      num_tramites: Number(comercializadora.num_tramites) || 0,
      num_files: Number(comercializadora.num_files) || 0,
      files: files,
    };

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching comercializadora:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
