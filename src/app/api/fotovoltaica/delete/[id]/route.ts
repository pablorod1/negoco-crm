import { storage } from "@/core/firebase/firebaseConfig";
import { getTursoClient } from "@/core/libsql/client";
import { deleteObject, listAll, ref } from "firebase/storage";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fotovoltaica_id } = await params;
    const {
      organization_id,
    }: {
      fotovoltaica_id: string;
      organization_id: string;
    } = await req.json();

    if (!fotovoltaica_id || !organization_id) {
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

    const storageRef = ref(
      storage,
      `${organization_id}/fotovoltaicas/${fotovoltaica_id}`
    );

    try {
      // Listar todos los archivos en la carpeta
      const fileList = await listAll(storageRef);

      // Eliminar cada archivo
      const deletePromises = fileList.items.map((fileRef) =>
        deleteObject(fileRef)
      );
      await Promise.all(deletePromises);
    } catch (storageError) {
      console.error("Error al eliminar archivos:", storageError);
      // Si falla la eliminación de archivos, abortar toda la operación
      return NextResponse.json(
        {
          success: false,
          error: "Error al eliminar los archivos asociados a la solicitud",
        },
        { status: 500 }
      );
    }

    // 2. Solo si se eliminaron los archivos correctamente, eliminar el trámite de la base de datos
    const response = await tursoClient.execute({
      sql: `DELETE FROM fotovoltaica WHERE id = ?`,
      args: [fotovoltaica_id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró el trámite",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
