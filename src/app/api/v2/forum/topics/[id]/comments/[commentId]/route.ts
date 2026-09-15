import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import {
  isDireccionRole,
  updateForumCommentVisibility,
} from "@/forum/server";
import type { ApiResponse, ForumComment } from "@/forum/types";

const UpdateCommentSchema = z.object({
  is_hidden: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
): Promise<NextResponse<ApiResponse<ForumComment>>> {
  try {
    const { commentId } = await params;
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!isDireccionRole(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
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

    const validation = UpdateCommentSchema.safeParse(requestBody);
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
    const comment = await updateForumCommentVisibility(
      tursoClient,
      commentId,
      validation.data.is_hidden,
      authResult.user.id,
    );

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Forum comment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: comment });
  } catch (error) {
    console.error("Error updating forum comment:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
