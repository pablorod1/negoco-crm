import { uploadAvatar } from "@/lib/firebase/data/uploadFiles";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: user_id } = await params;
    // Obtener los datos del formulario
    const formData = await req.formData();

    // Obtener el archivo
    const file = formData.get("file") as File;
    const organization_id = formData.get("organization_id") as string;

    if (!user_id || !file || !organization_id) {
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

    const { downloadURL } = await uploadAvatar(file, user_id, organization_id);

    if (!downloadURL) {
      return NextResponse.json(
        {
          success: false,
          error: "Error uploading avatar",
        },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `UPDATE user SET image = ? WHERE id = ?`,
      args: [downloadURL, user_id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating user avatar:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error updating user avatar",
      },
      { status: 500 }
    );
  }
}
