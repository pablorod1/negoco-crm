import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { createDashboardAnnouncement } from "@/dashboard-announcements/server";
import type {
  ApiResponse,
  DashboardAnnouncement,
  DashboardAnnouncementPayload,
} from "@/dashboard-announcements/types";

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(120),
  message: z.string().trim().min(1, "El mensaje es obligatorio").max(1200),
  variant: z.enum(["info", "warning", "success", "danger"]).default("info"),
  cta_label: z.string().trim().max(60).optional().nullable(),
  cta_url: z.string().trim().max(500).optional().nullable(),
});

const isSafeCtaUrl = (value: string) =>
  value.startsWith("/") || /^https?:\/\//.test(value);

const normalizeAnnouncementPayload = (
  data: z.infer<typeof AnnouncementSchema>,
): DashboardAnnouncementPayload | { error: string } => {
  const payload: DashboardAnnouncementPayload = {
    title: data.title,
    message: data.message,
    variant: data.variant,
    cta_label: data.cta_label || null,
    cta_url: data.cta_url || null,
  };

  if (Boolean(payload.cta_label) !== Boolean(payload.cta_url)) {
    return { error: "El botón necesita etiqueta y URL" };
  }

  if (payload.cta_url && !isSafeCtaUrl(payload.cta_url)) {
    return { error: "La URL del botón no es válida" };
  }

  return payload;
};

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<DashboardAnnouncement>>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (authResult.user.role !== "admin") {
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

    const validation = AnnouncementSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Validation failed",
        },
        { status: 400 },
      );
    }

    const payload = normalizeAnnouncementPayload(validation.data);
    if ("error" in payload) {
      return NextResponse.json(
        { success: false, error: payload.error },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    const announcement = await createDashboardAnnouncement(
      tursoClient,
      payload,
      authResult.user.id,
    );

    return NextResponse.json(
      { success: true, data: announcement },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating dashboard announcement:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
