import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import {
  createForumTopic,
  isDireccionRole,
  listForumTopics,
} from "@/forum/server";
import type { ApiResponse, ForumTopic } from "@/forum/types";

const CreateTopicSchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio").max(140),
  description: z.string().trim().max(600).optional(),
});

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ForumTopic[]>>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tursoClient = getTursoClient(request);
    const topics = await listForumTopics(
      tursoClient,
      isDireccionRole(authResult.user.role),
    );

    return NextResponse.json({ success: true, data: topics });
  } catch (error) {
    console.error("Error fetching forum topics:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ForumTopic>>> {
  try {
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

    const validation = CreateTopicSchema.safeParse(requestBody);
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
    const topic = await createForumTopic(
      tursoClient,
      validation.data.title,
      validation.data.description || null,
      authResult.user.id,
    );

    return NextResponse.json({ success: true, data: topic }, { status: 201 });
  } catch (error) {
    console.error("Error creating forum topic:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
