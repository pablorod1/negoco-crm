import { sendWelcomeEmail } from "@/core/hooks/welcome-email";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Request validation schema for welcome email
 */
const WelcomeEmailSchema = z.object({
  user_to: z.object({
    email: z.string().email("Invalid email format"),
    name: z.string().min(1, "Name is required"),
    org_logo: z.string().optional().nullable(),
  }),
});

/**
 * Response interface for welcome email API
 */
interface WelcomeEmailResponse {
  success: boolean;
  info?: Record<string, unknown>;
  error?: string;
  details?: z.ZodIssue[];
}

/**
 * Sends a welcome email to a new user
 * @param request - Next.js request object containing user details
 * @returns Promise<NextResponse<WelcomeEmailResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<WelcomeEmailResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = WelcomeEmailSchema.parse(body);

    const { user_to } = validatedData;

    // Get origin for link construction
    const origin = request.headers.get("origin");
    if (!origin) {
      return NextResponse.json(
        { success: false, error: "Origin header is required" },
        { status: 400 }
      );
    }

    // Send welcome email using existing function
    const { success, error, info } = await sendWelcomeEmail({
      email_to: user_to.email,
      name: user_to.name,
      link: origin,
      req: request,
      org_logo: user_to.org_logo || undefined,
    });

    if (!success) {
      return NextResponse.json(
        { success: false, error: error || "Failed to send welcome email" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, info: info as unknown as Record<string, unknown> },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Error sending welcome email:", error);

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

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while sending welcome email",
      },
      { status: 500 }
    );
  }
}
