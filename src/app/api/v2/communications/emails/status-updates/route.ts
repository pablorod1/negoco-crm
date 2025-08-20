import { sendTramiteStatusUpdatedNotification } from "@/tramites/hooks/update-tramite-status-notification-email";
import { sendComparativaStatusUpdatedNotification } from "@/comparativas/hooks/update-comparativa-status-notification-email";
import { sendFotovoltaicaStatusUpdatedNotification } from "@/fotovoltaica/hooks/update-fotovoltaica-status-notification-email";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Base user schema for email notifications
 */
const UserToSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  org_logo: z.string().optional().nullable(),
});

/**
 * Status change schema
 */
const StatusSchema = z.object({
  old: z.string().min(1, "Old status is required"),
  new: z.string().min(1, "New status is required"),
});

/**
 * Request validation schemas for different notification types
 */
const TramiteStatusUpdateSchema = z.object({
  type: z.literal("tramite"),
  user_to: UserToSchema,
  tramite_id: z.string().min(1, "Tramite ID is required"),
  status: StatusSchema,
  client: z.object({
    name: z.string().min(1, "Client name is required"),
    last_name: z.string().optional(),
  }),
});

const ComparativaStatusUpdateSchema = z.object({
  type: z.literal("comparativa"),
  user_to: UserToSchema,
  comparativa_id: z.string().min(1, "Comparativa ID is required"),
  comparativa_name: z.string().min(1, "Comparativa name is required"),
  status: StatusSchema,
});

const FotovoltaicaStatusUpdateSchema = z.object({
  type: z.literal("fotovoltaica"),
  user_to: UserToSchema,
  fotovoltaica_id: z.string().min(1, "Fotovoltaica ID is required"),
  client: z.string().min(1, "Client name is required"),
  status: StatusSchema,
});

/**
 * Union schema for all status update types
 */
const StatusUpdateRequestSchema = z.discriminatedUnion("type", [
  TramiteStatusUpdateSchema,
  ComparativaStatusUpdateSchema,
  FotovoltaicaStatusUpdateSchema,
]);

/**
 * Response interface for status update email API
 */
interface StatusUpdateEmailResponse {
  success: boolean;
  type?: string;
  error?: string;
  details?: z.ZodIssue[];
}

/**
 * Sends status update emails for tramites, comparativas, or fotovoltaica
 * Consolidates the three separate status update endpoints into one
 * @param request - Next.js request object containing notification details
 * @returns Promise<NextResponse<StatusUpdateEmailResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<StatusUpdateEmailResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = StatusUpdateRequestSchema.parse(body);

    // Get origin for link construction
    const origin = request.headers.get("origin");
    if (!origin) {
      return NextResponse.json(
        { success: false, error: "Origin header is required" },
        { status: 400 }
      );
    }

    // Route to appropriate email handler based on type
    switch (validatedData.type) {
      case "tramite":
        await sendTramiteStatusUpdatedNotification({
          user_to: {
            ...validatedData.user_to,
            org_logo: validatedData.user_to.org_logo ?? undefined,
          },
          tramite_id: validatedData.tramite_id,
          status: validatedData.status,
          link: origin,
          req: request,
          client: validatedData.client,
        });
        break;

      case "comparativa":
        await sendComparativaStatusUpdatedNotification({
          user_to: {
            ...validatedData.user_to,
            org_logo: validatedData.user_to.org_logo ?? undefined,
          },
          comparativa_id: validatedData.comparativa_id,
          status: validatedData.status,
          link: origin,
          req: request,
          comparativa_name: validatedData.comparativa_name,
        });
        break;

      case "fotovoltaica":
        await sendFotovoltaicaStatusUpdatedNotification({
          user_to: {
            ...validatedData.user_to,
            org_logo: validatedData.user_to.org_logo ?? undefined,
          },
          fotovoltaica_id: validatedData.fotovoltaica_id,
          status: validatedData.status,
          link: origin,
          req: request,
          client: validatedData.client,
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Invalid notification type" },
          { status: 400 }
        );
    }

    return NextResponse.json(
      {
        success: true,
        type: validatedData.type,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Error sending status update email:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle email sending errors
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to send status update email",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while sending status update email",
      },
      { status: 500 }
    );
  }
}
