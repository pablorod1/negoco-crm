import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { createForumComment, isDireccionRole } from "@/forum/server";
import type { ApiResponse, ForumComment } from "@/forum/types";

const CreateCommentSchema = z.object({
  message: z.string().trim().min(1, "El comentario es obligatorio").max(3000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<ForumComment>>> {
  try {
    const { id } = await params;
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const validation = CreateCommentSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Validation failed",
        },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    const comment = await createForumComment(
      tursoClient,
      id,
      authResult.user.id,
      validation.data.message,
      isDireccionRole(authResult.user.role),
    );

    if (comment === "closed") {
      return NextResponse.json(
        { success: false, error: "Forum topic is closed" },
        { status: 409 },
      );
    }

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Forum topic not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (error) {
    console.error("Error creating forum comment:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
