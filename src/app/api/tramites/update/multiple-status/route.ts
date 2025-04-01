import { NOW_DATE } from "@/lib/core/const";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ids, status } = await req.json();

    if (!ids || ids.length === 0 || !status) {
      return NextResponse.json(
        { success: false, error: "No se han seleccionado trámites." },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Error al conectar con la base de datos." },
        { status: 500 }
      );
    }

    let query;
    const params = [];

    if (status === "Cobrado por Comercializadora") {
      query = `UPDATE tramites SET liquidez_status = ?, collection_date = ? WHERE id IN (${ids.map(() => "?").join(",")})`;
      params.push(status, NOW_DATE.toISOString(), ...ids);
    } else if (status === "Pagado al Comercial") {
      query = `UPDATE tramites SET liquidez_status = ?, payment_date = ? WHERE id IN (${ids.map(() => "?").join(",")})`;
      params.push(status, NOW_DATE.toISOString(), ...ids);
    } else {
      query = `UPDATE tramites SET liquidez_status = ? WHERE id IN (${ids.map(() => "?").join(",")})`;
      params.push(status, ...ids);
    }

    const res = await tursoClient.execute({
      sql: query,
      args: params,
    });

    if (res.rowsAffected === 0) {
      return NextResponse.json(
        { success: false, error: "No se han actualizado los trámites." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al actualizar los trámites:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar los trámites." },
      { status: 500 }
    );
  }
}
