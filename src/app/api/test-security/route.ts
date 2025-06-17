import { NextRequest, NextResponse } from "next/server";
import { SecurityAuditLogger } from "@/lib/chatbot/security";

export async function POST(req: NextRequest) {
  try {
    const { testType } = await req.json();

    // Test different types of security events
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "test-ip";

    switch (testType) {
      case "sql_injection":
        SecurityAuditLogger.logSQLInjectionAttempt(
          "test-user-id",
          ip,
          "SELECT * FROM users UNION SELECT * FROM passwords",
          "UNION SELECT detected in chatbot query"
        );
        break;

      case "xss_attempt":
        SecurityAuditLogger.logXSSAttempt(
          "test-user-id",
          ip,
          '<script>alert("XSS test")</script>'
        );
        break;

      case "unauthorized_access":
        SecurityAuditLogger.logUnauthorizedAccess(
          "test-user-id",
          "commercial",
          ip,
          "User attempted to access admin-only data"
        );
        break;

      case "rate_limit":
        SecurityAuditLogger.logRateLimitExceeded(
          "test-user-id",
          ip,
          "Mozilla/5.0 Test Browser"
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Invalid test type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Security event ${testType} logged and email sent (if configured)`,
    });
  } catch (error) {
    console.error("Error in security test:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test security system" },
      { status: 500 }
    );
  }
}

// GET endpoint to show available test types
export async function GET() {
  return NextResponse.json({
    availableTests: [
      "sql_injection",
      "xss_attempt",
      "unauthorized_access",
      "rate_limit",
    ],
    usage: 'POST to this endpoint with { "testType": "sql_injection" }',
    note: "Only HIGH and CRITICAL events will send emails",
  });
}
