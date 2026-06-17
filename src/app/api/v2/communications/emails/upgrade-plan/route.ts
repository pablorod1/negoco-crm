import { sendUpgradePlanEmail } from "@/core/hooks/upgrade-plan-email";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Request validation schema for upgrade plan email
 */
const UpgradePlanEmailSchema = z.object({
  user: z.object({
    email: z.email("Invalid email format"),
    name: z.string().min(1, "Name is required"),
    company: z.string().min(1, "Company is required"),
  }),
  plan: z.object({
    old: z.string().min(1, "Current plan is required"),
    new: z.string().min(1, "New plan is required"),
  }),
});

/**
 * Response interface for upgrade plan email API
 */
interface UpgradePlanEmailResponse {
  success: boolean;
  info?: Record<string, unknown>;
  error?: string;
  details?: z.ZodIssue[];
}

/**
 * Sends an upgrade plan request email to the management team
 * @param request - Next.js request object containing user and plan details
 * @returns Promise<NextResponse<UpgradePlanEmailResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UpgradePlanEmailResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = UpgradePlanEmailSchema.parse(body);

    const { user, plan } = validatedData;

    // Validate that the plan is actually changing
    if (plan.old === plan.new) {
      return NextResponse.json(
        {
          success: false,
          error: "New plan must be different from current plan",
        },
        { status: 400 }
      );
    }

    // Send upgrade plan request email using existing function
    const info = await sendUpgradePlanEmail({
      user: {
        name: user.name,
        email: user.email,
        company: user.company,
      },
      plan: {
        old: plan.old,
        new: plan.new,
      },
    });

    return NextResponse.json(
      {
        success: true,
        info: info as unknown as Record<string, unknown>,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Error sending upgrade plan email:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Handle email sending errors
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to send upgrade plan email",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while sending upgrade plan email",
      },
      { status: 500 }
    );
  }
}
