import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import {
  isPermissionKey,
  type PermissionKey,
} from "@/core/access-control/catalog";
import {
  AccessControlRequestError,
  getAccessControlSnapshot,
  updateAccessControl,
} from "@/core/access-control/server";
import { getTursoClient } from "@/core/libsql/client";

const PermissionKeySchema = z
  .string()
  .refine(isPermissionKey, "Unknown permission key")
  .transform((permissionKey) => permissionKey as PermissionKey);

const RoleUpdateSchema = z
  .object({
    subject_type: z.literal("role"),
    subject_id: z.string().trim().min(1, "Subject ID is required"),
    permission_key: PermissionKeySchema,
    enabled: z.boolean().nullable(),
  })
  .strict();

const UserUpdateSchema = z
  .object({
    subject_type: z.literal("user"),
    subject_id: z.string().trim().min(1, "Subject ID is required"),
    permission_key: PermissionKeySchema,
    enabled: z.boolean().nullable(),
  })
  .strict();

const AccessControlPatchSchema = z
  .object({
    updates: z
      .array(z.discriminatedUnion("subject_type", [RoleUpdateSchema, UserUpdateSchema]))
      .min(1, "At least one update is required")
      .max(500, "Too many updates"),
  })
  .strict()
  .superRefine(({ updates }, context) => {
    const subjects = new Set<string>();

    for (const [index, update] of updates.entries()) {
      const subject = `${update.subject_type}:${update.subject_id}:${update.permission_key}`;
      if (subjects.has(subject)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate permission update",
          path: ["updates", index],
        });
      }
      subjects.add(subject);
    }
  });

async function requireAdmin(request: NextRequest) {
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

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const snapshot = await getAccessControlSnapshot(getTursoClient(request));
    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    console.error("Error fetching access control:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const validation = AccessControlPatchSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message ?? "Validation failed",
        },
        { status: 400 },
      );
    }

    const snapshot = await updateAccessControl(
      getTursoClient(request),
      validation.data.updates,
    );
    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    if (error instanceof AccessControlRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("Error updating access control:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
