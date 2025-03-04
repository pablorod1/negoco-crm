import { User } from "@/lib/core/types";
import { uploadAvatar } from "@/lib/firebase/data/uploadFiles";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    // Obtener los datos del formulario
    const formData = await req.formData();

    // Obtener el archivo
    const file = formData.get("file") as File;

    // Obtener los datos del usuario (parseados desde JSON)
    const userDataString = formData.get("userData") as string;
    const userData: User = JSON.parse(userDataString);

    if (!userData || !file) {
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

    const { downloadURL } = await uploadAvatar(file, userData);

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
      args: [downloadURL, userData.id],
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
