import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import {
  getForumTopic,
  isDireccionRole,
  updateForumTopic,
} from "@/forum/server";
import type { ApiResponse, ForumTopicDetail } from "@/forum/types";

const UpdateTopicSchema = z
  .object({
    title: z.string().trim().min(3).max(140).optional(),
    description: z.union([z.string().trim().max(600), z.null()]).optional(),
    status: z.enum(["open", "closed"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No hay cambios para aplicar",
  });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<ForumTopicDetail>>> {
  try {
    const { id } = await params;
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tursoClient = getTursoClient(request);
    const detail = await getForumTopic(
      tursoClient,
      id,
      isDireccionRole(authResult.user.role),
    );

    if (!detail) {
      return NextResponse.json(
        { success: false, error: "Forum topic not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error("Error fetching forum topic:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<ForumTopicDetail>>> {
  try {
    const { id } = await params;
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

    const validation = UpdateTopicSchema.safeParse(requestBody);
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
    const detail = await updateForumTopic(tursoClient, id, validation.data);
    if (!detail) {
      return NextResponse.json(
        { success: false, error: "Forum topic not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error("Error updating forum topic:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
