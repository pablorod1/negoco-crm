import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { getActiveDashboardAnnouncement } from "@/dashboard-announcements/server";
import type {
  ApiResponse,
  DashboardAnnouncement,
} from "@/dashboard-announcements/types";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<DashboardAnnouncement | null>>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tursoClient = getTursoClient(request);
    const announcement = await getActiveDashboardAnnouncement(tursoClient);

    return NextResponse.json({ success: true, data: announcement });
  } catch (error) {
    console.error("Error fetching active dashboard announcement:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
