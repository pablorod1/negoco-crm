import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/auth"; // Importar configuración de BetterAuth

export async function POST(req: NextRequest) {
  try {
    const { userId, organizationId, role } = await req.json();

    if (!userId || !organizationId || !role) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const auth = getAuth(req);

    // Llamar a la API de BetterAuth para agregar al miembro
    const result = await auth.api.addMember({
      body: {
        userId,
        organizationId,
        role,
      },
    });

    if (result) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error adding user to organization:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
