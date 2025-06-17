import { NextRequest } from "next/server";
import { ConversationMessage } from "@/lib/ollama/ollamaService";
import { sendSecurityBreachEmail } from "@/lib/hooks/send-security-breach-email";

// Security configuration constants
export const SECURITY_CONFIG = {
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 30,
  MAX_REQUESTS_PER_HOUR: 200,
  MAX_REQUESTS_PER_DAY: 1000,

  // Input validation
  MAX_MESSAGE_LENGTH: 2000,
  MAX_CONVERSATION_HISTORY_LENGTH: 10,
  MIN_MESSAGE_LENGTH: 3,

  // Query complexity limits
  MAX_SQL_LENGTH: 2000,
  MAX_JOIN_COUNT: 5,
  MAX_WHERE_CONDITIONS: 10,
  MAX_RESULT_LIMIT: 100,

  // Timeouts
  QUERY_TIMEOUT_MS: 30000,
  AI_RESPONSE_TIMEOUT_MS: 45000,

  // Blocked patterns
  DANGEROUS_SQL_PATTERNS: [
    /;\s*(drop|delete|update|insert|alter|create|replace|truncate|exec|call|grant|revoke)\b/i,
    /union\s+select/i,
    /information_schema/i,
    /sqlite_master/i,
    /pragma/i,
    /attach\s+database/i,
    /load_extension/i,
    /--/,
    /\/\*/,
    /\*\//,
    /xp_/i,
    /sp_/i,
  ],

  BLOCKED_KEYWORDS: [
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "key",
    "auth",
    "admin_password",
    "hash",
    "salt",
    "credential",
    "session_token",
    "api_key",
    "private_key",
    "master_key",
    "encryption_key",
  ],

  // XSS prevention patterns
  XSS_PATTERNS: [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
  ],
} as const;

// Rate limiting store (in production, use Redis or similar)
class RateLimitStore {
  private store = new Map<
    string,
    { count: number; windowStart: number; daily: number; hourly: number }
  >();
  private readonly WINDOW_SIZE_MS = 60 * 1000; // 1 minute
  private readonly HOUR_MS = 60 * 60 * 1000; // 1 hour
  private readonly DAY_MS = 24 * 60 * 60 * 1000; // 1 day

  private getKey(identifier: string): string {
    return `rate_limit:${identifier}`;
  }

  private cleanupExpired(key: string): void {
    const record = this.store.get(key);
    if (!record) return;

    const now = Date.now();

    // Reset counters if windows have expired
    if (now - record.windowStart > this.WINDOW_SIZE_MS) {
      record.count = 0;
      record.windowStart = now;
    }

    // Reset hourly counter
    if (now - record.windowStart > this.HOUR_MS) {
      record.hourly = 0;
    }

    // Reset daily counter
    if (now - record.windowStart > this.DAY_MS) {
      record.daily = 0;
    }
  }

  public checkAndIncrement(identifier: string): {
    allowed: boolean;
    retryAfter?: number;
  } {
    const key = this.getKey(identifier);
    this.cleanupExpired(key);

    const record = this.store.get(key) || {
      count: 0,
      windowStart: Date.now(),
      daily: 0,
      hourly: 0,
    };

    // Check all limits
    if (record.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
      return { allowed: false, retryAfter: 60 };
    }

    if (record.hourly >= SECURITY_CONFIG.MAX_REQUESTS_PER_HOUR) {
      return { allowed: false, retryAfter: 3600 };
    }

    if (record.daily >= SECURITY_CONFIG.MAX_REQUESTS_PER_DAY) {
      return { allowed: false, retryAfter: 86400 };
    }

    // Increment counters
    record.count++;
    record.hourly++;
    record.daily++;

    this.store.set(key, record);
    return { allowed: true };
  }

  public getRemainingRequests(identifier: string): {
    minute: number;
    hour: number;
    day: number;
  } {
    const key = this.getKey(identifier);
    this.cleanupExpired(key);

    const record = this.store.get(key);
    if (!record) {
      return {
        minute: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE,
        hour: SECURITY_CONFIG.MAX_REQUESTS_PER_HOUR,
        day: SECURITY_CONFIG.MAX_REQUESTS_PER_DAY,
      };
    }

    return {
      minute: Math.max(
        0,
        SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE - record.count
      ),
      hour: Math.max(0, SECURITY_CONFIG.MAX_REQUESTS_PER_HOUR - record.hourly),
      day: Math.max(0, SECURITY_CONFIG.MAX_REQUESTS_PER_DAY - record.daily),
    };
  }
}

const rateLimitStore = new RateLimitStore();

// Security audit logger with email notifications
export class SecurityAuditLogger {
  private static async sendSecurityBreachEmail(event: {
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
    ip?: string;
    userAgent?: string;
    details: string;
    timestamp: Date;
    userName?: string;
    userEmail?: string;
  }): Promise<void> {
    try {
      // Only send emails for HIGH and CRITICAL events to avoid spam
      if (event.severity === "HIGH" || event.severity === "CRITICAL") {
        await sendSecurityBreachEmail({
          securityEvent: {
            ...event,
            ip: event.ip || "unknown", // Ensure ip is always provided
          },
        });
      }
    } catch (error) {
      console.error("Error sending security breach email:", error);
    }
  }

  private static logSecurityEvent(event: {
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
    ip?: string;
    userAgent?: string;
    details: string;
    timestamp: Date;
  }): void {
    // Console logging for immediate visibility
    console.warn("🚨 SECURITY EVENT:", {
      ...event,
      timestamp: event.timestamp.toISOString(),
    });

    // Send email notification for serious events
    this.sendSecurityBreachEmail(event).catch(console.error);

    // Here you could also:
    // - Send to external monitoring service (Datadog, Splunk, etc.)
    // - Store in a security log file
    // - Update security metrics
  }

  public static logRateLimitExceeded(
    userId: string,
    ip: string,
    userAgent: string
  ): void {
    this.logSecurityEvent({
      type: "RATE_LIMIT",
      severity: "MEDIUM",
      userId,
      ip,
      userAgent,
      details: "Rate limit exceeded for chatbot API",
      timestamp: new Date(),
    });
  }

  public static logSQLInjectionAttempt(
    userId: string,
    ip: string,
    query: string,
    pattern: string
  ): void {
    this.logSecurityEvent({
      type: "SQL_INJECTION",
      severity: "CRITICAL",
      userId,
      ip,
      details: `SQL injection attempt detected. Pattern: ${pattern}, Query: ${query.substring(0, 200)}...`,
      timestamp: new Date(),
    });
  }

  public static logXSSAttempt(userId: string, ip: string, input: string): void {
    this.logSecurityEvent({
      type: "XSS_ATTEMPT",
      severity: "HIGH",
      userId,
      ip,
      details: `XSS attempt detected in input: ${input.substring(0, 200)}...`,
      timestamp: new Date(),
    });
  }

  public static logSuspiciousPattern(
    userId: string,
    ip: string,
    pattern: string,
    input: string
  ): void {
    this.logSecurityEvent({
      type: "SUSPICIOUS_PATTERN",
      severity: "MEDIUM",
      userId,
      ip,
      details: `Suspicious pattern detected: ${pattern} in input: ${input.substring(0, 200)}...`,
      timestamp: new Date(),
    });
  }

  public static logUnauthorizedAccess(
    userId: string,
    userRole: string,
    ip: string,
    details: string
  ): void {
    this.logSecurityEvent({
      type: "UNAUTHORIZED_ACCESS",
      severity: "HIGH",
      userId,
      userRole,
      ip,
      details,
      timestamp: new Date(),
    });
  }
}

// Input validation and sanitization
export class InputValidator {
  public static validateMessage(message: string): {
    isValid: boolean;
    sanitized: string;
    errors: string[];
  } {
    const errors: string[] = [];
    let sanitized = message;

    // Length validation
    if (
      !message ||
      message.trim().length < SECURITY_CONFIG.MIN_MESSAGE_LENGTH
    ) {
      errors.push(
        `Message must be at least ${SECURITY_CONFIG.MIN_MESSAGE_LENGTH} characters long`
      );
    }

    if (message.length > SECURITY_CONFIG.MAX_MESSAGE_LENGTH) {
      errors.push(
        `Message exceeds maximum length of ${SECURITY_CONFIG.MAX_MESSAGE_LENGTH} characters`
      );
    }

    // XSS prevention
    for (const pattern of SECURITY_CONFIG.XSS_PATTERNS) {
      if (pattern.test(message)) {
        errors.push("Invalid characters or patterns detected in message");
        sanitized = message.replace(pattern, "");
      }
    }

    // Blocked keywords check
    const lowerMessage = message.toLowerCase();
    for (const keyword of SECURITY_CONFIG.BLOCKED_KEYWORDS) {
      if (lowerMessage.includes(keyword)) {
        errors.push("Message contains restricted content");
        break;
      }
    }

    // Remove potentially dangerous characters
    sanitized = sanitized
      .replace(/[<>'"]/g, "") // Remove HTML/script chars
      .replace(/[^\w\s\u00C0-\u017F.,!?¿¡():;/-]/g, "") // Keep only safe chars + Spanish chars
      .trim();

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  public static validateConversationHistory(history?: ConversationMessage[]): {
    isValid: boolean;
    sanitized: ConversationMessage[];
    errors: string[];
  } {
    const errors: string[] = [];
    let sanitized: ConversationMessage[] = [];

    if (!history) {
      return { isValid: true, sanitized: [], errors: [] };
    }

    if (history.length > SECURITY_CONFIG.MAX_CONVERSATION_HISTORY_LENGTH) {
      errors.push(
        `Conversation history exceeds maximum length of ${SECURITY_CONFIG.MAX_CONVERSATION_HISTORY_LENGTH} messages`
      );
      sanitized = history.slice(
        -SECURITY_CONFIG.MAX_CONVERSATION_HISTORY_LENGTH
      );
    } else {
      sanitized = [...history];
    }

    // Validate each message in history
    sanitized = sanitized.map((msg) => {
      const validation = this.validateMessage(msg.content);
      return {
        ...msg,
        content: validation.sanitized,
      };
    });

    return { isValid: errors.length === 0, sanitized, errors };
  }
}

// SQL security validator
export class SQLSecurityValidator {
  public static validateSQLQuery(
    sqlQuery: string,
    userId: string,
    userRole: string
  ): {
    isValid: boolean;
    errors: string[];
    securityLevel: "SAFE" | "SUSPICIOUS" | "DANGEROUS";
  } {
    const errors: string[] = [];
    let securityLevel: "SAFE" | "SUSPICIOUS" | "DANGEROUS" = "SAFE";

    // Basic structure validation
    if (!sqlQuery || typeof sqlQuery !== "string") {
      errors.push("Invalid SQL query format");
      return { isValid: false, errors, securityLevel: "DANGEROUS" };
    }

    // Length validation
    if (sqlQuery.length > SECURITY_CONFIG.MAX_SQL_LENGTH) {
      errors.push(
        `SQL query exceeds maximum length of ${SECURITY_CONFIG.MAX_SQL_LENGTH} characters`
      );
      securityLevel = "SUSPICIOUS";
    }

    // Must be a SELECT query only
    if (!/^\s*select\s+/i.test(sqlQuery.trim())) {
      errors.push("Only SELECT queries are allowed");
      securityLevel = "DANGEROUS";
    }

    // Check for dangerous patterns
    for (const pattern of SECURITY_CONFIG.DANGEROUS_SQL_PATTERNS) {
      if (pattern.test(sqlQuery)) {
        errors.push(`Dangerous SQL pattern detected: ${pattern.source}`);
        securityLevel = "DANGEROUS";
      }
    }

    // Validate LIMIT clause
    const limitMatch = sqlQuery.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      const limitValue = parseInt(limitMatch[1]);
      if (limitValue > SECURITY_CONFIG.MAX_RESULT_LIMIT) {
        errors.push(
          `LIMIT value exceeds maximum of ${SECURITY_CONFIG.MAX_RESULT_LIMIT}`
        );
        securityLevel = "SUSPICIOUS";
      }
    } else {
      errors.push("SQL query must include a LIMIT clause");
      securityLevel = "SUSPICIOUS";
    }

    // Count JOINs
    const joinCount = (sqlQuery.match(/\bjoin\b/gi) || []).length;
    if (joinCount > SECURITY_CONFIG.MAX_JOIN_COUNT) {
      errors.push(
        `Too many JOINs: ${joinCount}, maximum allowed: ${SECURITY_CONFIG.MAX_JOIN_COUNT}`
      );
      securityLevel = "SUSPICIOUS";
    }

    // Count WHERE conditions
    const whereConditions =
      (sqlQuery.match(/\band\b|\bor\b/gi) || []).length + 1;
    if (whereConditions > SECURITY_CONFIG.MAX_WHERE_CONDITIONS) {
      errors.push(
        `Too many WHERE conditions: ${whereConditions}, maximum allowed: ${SECURITY_CONFIG.MAX_WHERE_CONDITIONS}`
      );
      securityLevel = "SUSPICIOUS";
    }

    // Role-based validation
    if (userRole === "2" || userRole === "commercial") {
      // Commercial users must have user_id filters
      if (
        !sqlQuery.includes(`user_id = '${userId}'`) &&
        !sqlQuery.includes(`t.user_id = ${userId}`) &&
        !sqlQuery.includes(`user_id IN`)
      ) {
        errors.push("Commercial users must include user_id filters in queries");
        securityLevel = "DANGEROUS";
      }
    }

    return {
      isValid: errors.length === 0 && securityLevel !== "DANGEROUS",
      errors,
      securityLevel,
    };
  }

  public static sanitizeSQL(sqlQuery: string): string {
    // Remove comments
    let sanitized = sqlQuery
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, " ").trim();

    // Ensure proper LIMIT
    if (!/limit\s+\d+/i.test(sanitized)) {
      sanitized += " LIMIT 50";
    }

    return sanitized;
  }
}

// Main security middleware
export class ChatbotSecurity {
  public static async validateRequest(
    req: NextRequest,
    userId: string,
    userRole: string
  ): Promise<{ isValid: boolean; errors: string[]; retryAfter?: number }> {
    const errors: string[] = [];
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Rate limiting
    const rateLimitResult = rateLimitStore.checkAndIncrement(userId);
    if (!rateLimitResult.allowed) {
      SecurityAuditLogger.logRateLimitExceeded(userId, ip, userAgent);
      errors.push("Rate limit exceeded. Please try again later.");
      return { isValid: false, errors, retryAfter: rateLimitResult.retryAfter };
    }

    // Role-based validation
    if (
      !userRole ||
      (userRole !== "1" &&
        userRole !== "2" &&
        userRole !== "admin" &&
        userRole !== "commercial")
    ) {
      SecurityAuditLogger.logUnauthorizedAccess(
        userId,
        userRole,
        ip,
        "Invalid user role"
      );
      errors.push("Unauthorized access - invalid role");
      return { isValid: false, errors };
    }

    // Additional security checks can be added here
    // - IP-based restrictions
    // - User behavior analysis
    // - Geographic restrictions
    // - Time-based restrictions

    return { isValid: true, errors: [] };
  }
  public static async validateAndSanitizeInput(
    message: string,
    conversationHistory: ConversationMessage[] | undefined,
    userId: string,
    ip: string
  ): Promise<{
    isValid: boolean;
    sanitizedMessage: string;
    sanitizedHistory: ConversationMessage[];
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validate message
    const messageValidation = InputValidator.validateMessage(message);
    if (!messageValidation.isValid) {
      // Log suspicious patterns
      for (const error of messageValidation.errors) {
        if (
          error.includes("Invalid characters") ||
          error.includes("restricted content")
        ) {
          SecurityAuditLogger.logSuspiciousPattern(userId, ip, error, message);
        }
      }
      errors.push(...messageValidation.errors);
    }

    // Check for XSS attempts
    for (const pattern of SECURITY_CONFIG.XSS_PATTERNS) {
      if (pattern.test(message)) {
        SecurityAuditLogger.logXSSAttempt(userId, ip, message);
        break;
      }
    }

    // Validate conversation history
    const historyValidation =
      InputValidator.validateConversationHistory(conversationHistory);
    if (!historyValidation.isValid) {
      errors.push(...historyValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      sanitizedMessage: messageValidation.sanitized,
      sanitizedHistory: historyValidation.sanitized,
      errors,
    };
  }

  public static validateSQLQuery(
    sqlQuery: string,
    userId: string,
    userRole: string,
    ip: string
  ): { isValid: boolean; sanitizedSQL: string; errors: string[] } {
    const validation = SQLSecurityValidator.validateSQLQuery(
      sqlQuery,
      userId,
      userRole
    );

    if (validation.securityLevel === "DANGEROUS") {
      SecurityAuditLogger.logSQLInjectionAttempt(
        userId,
        ip,
        sqlQuery,
        validation.errors.join(", ")
      );
    }

    return {
      isValid: validation.isValid,
      sanitizedSQL: validation.isValid
        ? SQLSecurityValidator.sanitizeSQL(sqlQuery)
        : "",
      errors: validation.errors,
    };
  }

  public static getRemainingRequests(userId: string): {
    minute: number;
    hour: number;
    day: number;
  } {
    return rateLimitStore.getRemainingRequests(userId);
  }
}

// Security headers for responses
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
} as const;
