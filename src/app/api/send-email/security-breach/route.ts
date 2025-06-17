import { sendSecurityBreachEmail } from "@/lib/hooks/send-security-breach-email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      securityEvent,
    }: {
      securityEvent: {
        type:
          | "RATE_LIMIT"
          | "SQL_INJECTION"
          | "XSS_ATTEMPT"
          | "INVALID_INPUT"
          | "UNAUTHORIZED_ACCESS"
          | "QUERY_TIMEOUT"
          | "SUSPICIOUS_PATTERN";
        severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        userId?: string;
        userRole?: string;
        ip: string;
        userAgent?: string;
        details: string;
        timestamp: Date;
        userName?: string;
        userEmail?: string;
      };
    } = await req.json();

    // Validate required fields
    if (
      !securityEvent.type ||
      !securityEvent.severity ||
      !securityEvent.ip ||
      !securityEvent.details
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required security event fields" },
        { status: 400 }
      );
    }

    // Only send emails for HIGH and CRITICAL severity events to avoid spam
    if (
      securityEvent.severity === "HIGH" ||
      securityEvent.severity === "CRITICAL"
    ) {
      await sendSecurityBreachEmail({
        securityEvent: {
          ...securityEvent,
          timestamp: new Date(securityEvent.timestamp), // Ensure proper Date object
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error enviando el email de seguridad:", error);
    return NextResponse.json(
      { success: false, error: "Error enviando el email de seguridad" },
      { status: 500 }
    );
  }
}
