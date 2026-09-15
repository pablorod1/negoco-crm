import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { cancelPendingProcessingJobs } from "@/crm-settings/processing-jobs";
import { getCrmSettings, updateCrmSettings } from "@/crm-settings/server";
import { getTenantInfoFromRequest } from "@/crm-settings/utils";

const AutomationSchema = z.object({
  enabled: z.boolean(),
  delay_value: z.coerce.number().int().min(0).max(525_600),
  delay_unit: z.enum(["minutes", "hours", "days"]),
});

const CrmSettingsPatchSchema = z.object({
  providers: z.array(z.string().trim().max(80)).max(100).optional(),
  processing_auto_activation: AutomationSchema.optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tursoClient = getTursoClient(request);
    const settings = await getCrmSettings(tursoClient);

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error fetching CRM settings:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    const validation = CrmSettingsPatchSchema.safeParse(requestBody);
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
    const settings = await updateCrmSettings(tursoClient, validation.data);

    if (
      validation.data.processing_auto_activation &&
      !validation.data.processing_auto_activation.enabled
    ) {
      const tenantInfo = getTenantInfoFromRequest(request);
      await cancelPendingProcessingJobs({ tenantSlug: tenantInfo.tenant_slug });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error updating CRM settings:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
