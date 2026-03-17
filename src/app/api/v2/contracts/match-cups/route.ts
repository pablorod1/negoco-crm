import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";

const MatchCupsSchema = z.object({
  cups: z.array(z.string().min(16).max(25)).min(1).max(5000),
});

interface MatchedEntry {
  cups: string;
  tramiteId: string;
  status: string;
  liquidezStatus: string | null;
  clientName: string;
  comercialName: string;
  newCompany: string;
  activationDate: string;
  comision: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = MatchCupsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          matched: [],
          unmatched: [],
          error: "Lista de CUPS inválida.",
        },
        { status: 400 },
      );
    }

    const { cups } = validation.data;
    const startTime = performance.now();
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          matched: [],
          unmatched: [],
          error: "Error al conectar con la base de datos.",
        },
        { status: 500 },
      );
    }

    // Query in batches of 500 to avoid SQLite variable limits
    const BATCH_SIZE = 500;
    const allMatched: MatchedEntry[] = [];

    // Normalize CUPS to base-20 for flexible matching (with/without punto de medida suffix)
    const cupsBaseMap = new Map<string, string>();
    for (const c of cups) {
      cupsBaseMap.set(c.substring(0, 20), c);
    }

    for (let i = 0; i < cups.length; i += BATCH_SIZE) {
      const batch = cups.slice(i, i + BATCH_SIZE);
      const baseBatch = batch.map((c) => c.substring(0, 20));
      const placeholders = baseBatch.map(() => "?").join(",");

      const result = await tursoClient.execute({
        sql: `
          SELECT
            con.CUPS AS cups,
            t.id AS tramite_id,
            t.status,
            t.liquidez_status,
            t.activation_date,
            COALESCE(t.comision, 0) AS comision,
            c.name || ' ' || c.last_name AS client_name,
            COALESCE(u.name, t.sales_name, '') AS comercial_name,
            COALESCE(com.name, con.new_company, '') AS new_company
          FROM contracts con
          JOIN tramites t ON con.tramite_id = t.id
          LEFT JOIN clients c ON t.client_id = c.id
          LEFT JOIN user u ON t.user_id = u.id
          LEFT JOIN comercializadoras com ON con.new_company = com.id OR con.new_company = com.name
          WHERE SUBSTR(con.CUPS, 1, 20) IN (${placeholders})
            AND t.status IN ('Activo', 'Baja')
          ORDER BY
            CASE WHEN t.status = 'Activo' THEN 0 ELSE 1 END,
            t.activation_date DESC
        `,
        args: baseBatch,
      });

      for (const row of result.rows) {
        const base = (row.cups as string).substring(0, 20);
        allMatched.push({
          cups: cupsBaseMap.get(base) ?? (row.cups as string),
          tramiteId: row.tramite_id as string,
          status: row.status as string,
          liquidezStatus: row.liquidez_status as string | null,
          clientName: (row.client_name as string) || "",
          comercialName: (row.comercial_name as string) || "",
          newCompany: (row.new_company as string) || "",
          activationDate: (row.activation_date as string) || "",
          comision: Number(row.comision) || 0,
        });
      }
    }

    // Deduplicate: if a CUPS appears in multiple tramites, keep the Activo one (first due to ORDER BY)
    const matchedMap = new Map<string, MatchedEntry>();
    for (const entry of allMatched) {
      if (!matchedMap.has(entry.cups)) {
        matchedMap.set(entry.cups, entry);
      }
    }

    const matched = Array.from(matchedMap.values());
    const matchedCupsSet = new Set(matched.map((m) => m.cups));
    const unmatched = cups.filter((c) => !matchedCupsSet.has(c));

    console.log("[match-cups]", {
      cupsRequested: cups.length,
      cupsMatched: matched.length,
      cupsUnmatched: unmatched.length,
      durationMs: Math.round(performance.now() - startTime),
    });

    return NextResponse.json({
      success: true,
      matched,
      unmatched,
    });
  } catch (error) {
    console.error("[ERROR] match-cups failed:", error);
    return NextResponse.json(
      {
        success: false,
        matched: [],
        unmatched: [],
        error: "Error al buscar CUPS.",
      },
      { status: 500 },
    );
  }
}
