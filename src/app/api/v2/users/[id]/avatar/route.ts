import { uploadAvatar } from "@/core/firebase/data/uploadFiles";
import { storage } from "@/core/firebase/firebaseConfig";
import { getTursoClient } from "@/core/libsql/client";
import { deleteObject, listAll, ref } from "firebase/storage";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Request Validation Schema
const AvatarParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

const DeleteAvatarBodySchema = z.object({
  organization_id: z.string().min(1, "Organization ID is required"),
});

// Response Types
interface SuccessResponse {
  success: true;
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Updates user avatar (file upload)
 * @param request - Next.js request object containing FormData
 * @param params - Route parameters containing user ID
 * @returns Promise<NextResponse<SuccessResponse | ErrorResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id: user_id } = await params;

    // Validate parameters
    const validation = AvatarParamsSchema.safeParse({ id: user_id });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid parameters",
        },
        { status: 400 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const organization_id = formData.get("organization_id") as string;

    if (!file || !organization_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing file or organization_id in form data",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Upload avatar to Firebase Storage
    const { downloadURL } = await uploadAvatar(file, user_id, organization_id);

    if (!downloadURL) {
      return NextResponse.json(
        {
          success: false,
          error: "Error uploading avatar",
        },
        { status: 500 }
      );
    }

    // Update user record with new avatar URL
    const response = await tursoClient.execute({
      sql: `UPDATE user SET image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [downloadURL, user_id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating user avatar:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error updating user avatar",
      },
      { status: 500 }
    );
  }
}

/**
 * Deletes user avatar
 * @param request - Next.js request object containing organization_id
 * @param params - Route parameters containing user ID
 * @returns Promise<NextResponse<SuccessResponse | ErrorResponse>>
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id: user_id } = await params;

    // Validate parameters
    const validation = AvatarParamsSchema.safeParse({ id: user_id });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid parameters",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const bodyValidation = DeleteAvatarBodySchema.safeParse(body);
    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            bodyValidation.error.issues[0]?.message || "Invalid request body",
        },
        { status: 400 }
      );
    }

    const { organization_id } = bodyValidation.data;

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Delete avatar files from Firebase Storage
    const folderRef = ref(storage, `${organization_id}/avatars/${user_id}`);

    try {
      const files = await listAll(folderRef);
      await Promise.all(files.items.map((fileRef) => deleteObject(fileRef)));
    } catch (storageError) {
      console.warn("Error deleting avatar files from storage:", storageError);
      // Continue with database update even if storage deletion fails
    }

    // Update user record to remove avatar URL
    const response = await tursoClient.execute({
      sql: `UPDATE user SET image = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [user_id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user avatar:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error deleting user avatar",
      },
      { status: 500 }
    );
  }
}

/**
 * Legacy POST endpoint for avatar deletion (backward compatibility)
 * Delegates to DELETE method for proper RESTful implementation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  // For legacy POST requests that were used for deletion, delegate to DELETE
  return DELETE(request, { params });
}
