import { NextRequest, NextResponse } from "next/server";
import { SECURITY_HEADERS } from "@/lib/chatbot/security";

// Rate limiting by IP address for additional protection
const IP_RATE_LIMIT = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_IP_PER_MINUTE = 50;

export function middleware(request: NextRequest) {
  // Only apply to chatbot API routes
  if (!request.nextUrl.pathname.startsWith("/api/chatbot")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // IP-based rate limiting (additional layer)
  const now = Date.now();
  const ipLimit = IP_RATE_LIMIT.get(ip);

  if (ipLimit) {
    if (now < ipLimit.resetTime) {
      if (ipLimit.count >= MAX_REQUESTS_PER_IP_PER_MINUTE) {
        console.warn(`🚨 IP rate limit exceeded for ${ip}`);
        return NextResponse.json(
          { error: "Too many requests from this IP address" },
          {
            status: 429,
            headers: {
              ...SECURITY_HEADERS,
              "Retry-After": "60",
            },
          }
        );
      }
      ipLimit.count++;
    } else {
      // Reset counter
      ipLimit.count = 1;
      ipLimit.resetTime = now + 60000; // 1 minute
    }
  } else {
    IP_RATE_LIMIT.set(ip, { count: 1, resetTime: now + 60000 });
  }

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    // 1% chance
    const cutoff = now - 60000;
    for (const [key, value] of IP_RATE_LIMIT.entries()) {
      if (value.resetTime < cutoff) {
        IP_RATE_LIMIT.delete(key);
      }
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next();

  // Apply security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: "/api/chatbot/:path*",
};
