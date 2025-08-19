import { ClientDB, SignerDB } from "@/tramites/types";
import { getTursoClient } from "@/core/libsql/client";
import { addClient } from "@/tramites/utils/addTramiteHelpers";
import {
  updateSigner,
  updateTramite,
} from "@/tramites/utils/updateTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tramite_id } = await params;
    const {
      client,
      signer,
    }: { client: ClientDB; signer?: SignerDB | undefined } = await req.json();

    if (!client || !tramite_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Parameters",
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

    const insertClientRes = await addClient(client, tursoClient);

    if (!insertClientRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: insertClientRes.error || "Error inserting client",
        },
        { status: 500 }
      );
    }

    const updateTramiteRes = await updateTramite(
      { client_id: client.id },
      tramite_id,
      tursoClient
    );

    if (!updateTramiteRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateTramiteRes.error || "Error updating tramite",
        },
        { status: 500 }
      );
    }

    if (
      (client.type === "Empresa" ||
        client.type === "Comunidad de Propietarios") &&
      signer
    ) {
      const updateSignerRes = await updateSigner(
        { client_id: client.id },
        signer.id,
        tursoClient
      );

      if (!updateSignerRes.success) {
        return NextResponse.json(
          {
            success: false,
            error: updateSignerRes.error || "Error updating signer",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error al añadir cliente:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error adding client",
      },
      { status: 500 }
    );
  }
}
