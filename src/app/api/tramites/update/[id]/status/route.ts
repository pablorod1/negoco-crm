import { NOW_DATE } from "@/lib/core/const";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tramite_id } = await params;
    const {
      status,
      comision,
      comision_sales_person,
      note,
      notes,
      liquidez_status,
      collection_date,
      payment_date,
      activation_date,
      tramitation_date,
      renovation_date,
      user_id,
    } = await req.json();

    if (!tramite_id || !status || !user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    const updateFields = ["status = ?"];
    const queryArgs = [status];

    if (comision !== undefined) {
      updateFields.push("comision = ?");
      queryArgs.push(comision);
    }

    if (comision_sales_person !== undefined) {
      updateFields.push("comision_sales_person = ?");
      queryArgs.push(comision_sales_person);
    }

    if (note !== undefined) {
      const updatedNotes = [...notes, note];
      const notesJSON = JSON.stringify(updatedNotes);
      updateFields.push("notes = ?");
      queryArgs.push(notesJSON);
    }

    if (liquidez_status !== undefined) {
      updateFields.push("liquidez_status = ?");
      queryArgs.push(liquidez_status);
    }

    if (status === "Activo" && activation_date && renovation_date) {
      updateFields.push("activation_date = ?");
      queryArgs.push(activation_date);
      updateFields.push("renovation_date = ?");
      queryArgs.push(renovation_date);
    }

    if (status === "Verificado" && tramitation_date) {
      updateFields.push("tramitation_date = ?");
      queryArgs.push(tramitation_date);
    }

    if (status === "Baja") {
      updateFields.push("rejected_date = ?");
      queryArgs.push(NOW_DATE.toISOString());
    }

    if (liquidez_status === "Cobrado por Comercializadora" && collection_date) {
      updateFields.push("collection_date = ?");
      queryArgs.push(collection_date);
    }

    if (liquidez_status === "Pagado al Comercial" && payment_date) {
      updateFields.push("payment_date = ?");
      queryArgs.push(payment_date);
    }

    updateFields.push("updated_by = ?");
    queryArgs.push(user_id);

    updateFields.push("updated_at = ?");
    queryArgs.push(NOW_DATE.toISOString());

    queryArgs.push(tramite_id);

    const sql = `UPDATE tramites SET ${updateFields.join(", ")} WHERE id = ?`;

    const result = await tursoClient.execute({
      sql,
      args: queryArgs,
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tramite not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error al actualizar el estado del trámite :", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
