import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { updateDashboardAnnouncement } from "@/dashboard-announcements/server";
import type {
  ApiResponse,
  DashboardAnnouncement,
  UpdateDashboardAnnouncementPayload,
} from "@/dashboard-announcements/types";

const UpdateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    message: z.string().trim().min(1).max(1200).optional(),
    variant: z.enum(["info", "warning", "success", "danger"]).optional(),
    cta_label: z.string().trim().max(60).optional().nullable(),
    cta_url: z.string().trim().max(500).optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No hay cambios para aplicar",
  });

const isSafeCtaUrl = (value: string) =>
  value.startsWith("/") || /^https?:\/\//.test(value);

const normalizeUpdatePayload = (
  data: z.infer<typeof UpdateAnnouncementSchema>,
): UpdateDashboardAnnouncementPayload | { error: string } => {
  const payload: UpdateDashboardAnnouncementPayload = { ...data };

  if (payload.cta_label !== undefined) {
    payload.cta_label = payload.cta_label || null;
  }

  if (payload.cta_url !== undefined) {
    payload.cta_url = payload.cta_url || null;
  }

  if (payload.cta_label !== undefined || payload.cta_url !== undefined) {
    if (Boolean(payload.cta_label) !== Boolean(payload.cta_url)) {
      return { error: "El botón necesita etiqueta y URL" };
    }
  }

  if (payload.cta_url && !isSafeCtaUrl(payload.cta_url)) {
    return { error: "La URL del botón no es válida" };
  }

  return payload;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<DashboardAnnouncement>>> {
  try {
    const { id } = await params;
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

    const validation = UpdateAnnouncementSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Validation failed",
        },
        { status: 400 },
      );
    }

    const payload = normalizeUpdatePayload(validation.data);
    if ("error" in payload) {
      return NextResponse.json(
        { success: false, error: payload.error },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    const announcement = await updateDashboardAnnouncement(
      tursoClient,
      id,
      payload,
    );

    if (!announcement) {
      return NextResponse.json(
        { success: false, error: "Dashboard announcement not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: announcement });
  } catch (error) {
    console.error("Error updating dashboard announcement:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
