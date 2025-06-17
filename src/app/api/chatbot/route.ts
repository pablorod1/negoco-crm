import { NextRequest, NextResponse } from "next/server";

import { getTursoClient } from "@/lib/libsql/client";
import { verifySession } from "@/lib/dal";
import { ComparativaVM, ComparativaPlan } from "@/lib/core/types";
import {
  ollamaService,
  type ConversationMessage,
  type UserContext,
} from "@/lib/ollama/ollamaService";
import {
  DATABASE_QUERY_KEYWORDS,
  SUGGESTIONS,
  ERROR_MESSAGES,
  GENERAL_QUERY_PROMPT,
} from "@/lib/chatbot/constants";
import {
  ChatbotSecurity,
  SecurityAuditLogger,
  SECURITY_HEADERS,
} from "@/lib/chatbot/security";

// Types
interface ChatbotRequest {
  message: string;
  conversationHistory?: ConversationMessage[];
  super_id: string | null;
}

interface ChatbotResponse {
  response: string;
  suggestions?: readonly string[];
  tableData?: Record<string, unknown>[] | ComparativaVM[];
  queryType?: "database" | "general";
  dataType?: DataType;
  originalQuery?: string;
}

type DataType =
  | "tramites"
  | "clients"
  | "comparativas"
  | "fotovoltaica"
  | "contracts"
  | "users"
  | "files"
  | "signers"
  | "general_data";

// Constants
function isDataQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return DATABASE_QUERY_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );
}

// Utility functions
function detectDataType(
  sqlQuery: string,
  data: Record<string, unknown>[],
  originalQuery: string
): DataType {
  const lowerSql = sqlQuery.toLowerCase();
  const lowerOriginalQuery = originalQuery.toLowerCase();

  // Check SQL table references first (most reliable)
  if (lowerSql.includes("from comparativas")) {
    return "comparativas";
  }
  if (lowerSql.includes("from fotovoltaica")) {
    return "fotovoltaica";
  }
  if (lowerSql.includes("from contracts")) {
    return "contracts";
  }
  if (lowerSql.includes("from users")) {
    return "users";
  }
  if (lowerSql.includes("from files")) {
    return "files";
  }
  if (lowerSql.includes("from signers")) {
    return "signers";
  }
  if (lowerSql.includes("from clients")) {
    return "clients";
  }
  if (lowerSql.includes("from tramites")) {
    return "tramites";
  } // Check keywords in original query with priority for energy studies

  // Priority check: "estudios energéticos" should always be comparativas
  if (
    lowerOriginalQuery.includes("estudios energéticos") ||
    lowerOriginalQuery.includes("estudios energeticos") ||
    lowerOriginalQuery.includes("estudio energético") ||
    lowerOriginalQuery.includes("estudio energetico")
  ) {
    return "comparativas";
  }

  const comparativasKeywords = [
    "comparativa",
    "comparativas",
    "comparacion",
    "tarifa",
    "tarifas",
    "estudio",
    "estudios",
    "estudio energético",
    "estudios energéticos",
    "estudio energetico",
    "estudios energeticos",
  ];
  const fotovoltaicaKeywords = [
    "fotovoltaica",
    "fotovoltaico",
    "solar",
    "ppa",
    "proyecto",
    "proyectos",
    "placas solares",
    "placa solar",
    "placas fotovoltaicas",
    "placa fotovoltaica",
    "placas",
    "solares",
  ];
  const contractsKeywords = [
    "contrato",
    "contratos",
    "cups",
    "potencia",
    "consumo",
  ];
  const usersKeywords = [
    "usuario",
    "usuarios",
    "comercial",
    "comerciales",
    "admin",
    "backoffice",
  ];
  const filesKeywords = [
    "archivo",
    "archivos",
    "documento",
    "documentos",
    "file",
    "files",
  ];
  const signersKeywords = [
    "firmante",
    "firmantes",
    "signer",
    "signers",
    "firma",
    "firmas",
  ];
  const clientKeywords = [
    "cliente",
    "clientes",
    "direccion",
    "dirección",
    "contacto",
    "email",
    "telefono",
  ];
  if (
    comparativasKeywords.some((keyword) => lowerOriginalQuery.includes(keyword))
  ) {
    // Additional check: if it mentions "estudios" but also mentions solar/fotovoltaica terms, it should be fotovoltaica
    if (
      (lowerOriginalQuery.includes("estudio") ||
        lowerOriginalQuery.includes("estudios")) &&
      fotovoltaicaKeywords.some((keyword) =>
        lowerOriginalQuery.includes(keyword)
      )
    ) {
      return "fotovoltaica";
    }
    return "comparativas";
  }
  if (
    fotovoltaicaKeywords.some((keyword) => lowerOriginalQuery.includes(keyword))
  ) {
    return "fotovoltaica";
  }
  if (
    contractsKeywords.some((keyword) => lowerOriginalQuery.includes(keyword))
  ) {
    return "contracts";
  }
  if (usersKeywords.some((keyword) => lowerOriginalQuery.includes(keyword))) {
    return "users";
  }
  if (filesKeywords.some((keyword) => lowerOriginalQuery.includes(keyword))) {
    return "files";
  }
  if (signersKeywords.some((keyword) => lowerOriginalQuery.includes(keyword))) {
    return "signers";
  }
  if (clientKeywords.some((keyword) => lowerOriginalQuery.includes(keyword))) {
    return "clients";
  }

  // Check data structure to identify type
  if (data.length > 0) {
    const firstRow = data[0];

    // Comparativas table fields
    if (
      firstRow.company_name !== undefined &&
      firstRow.tariff_name !== undefined
    ) {
      return "comparativas";
    }

    // Fotovoltaica table fields
    if (
      firstRow.installation_power !== undefined ||
      firstRow.annual_generation !== undefined
    ) {
      return "fotovoltaica";
    }

    // Contracts table fields
    if (
      firstRow.cups !== undefined &&
      firstRow.contracted_power !== undefined
    ) {
      return "contracts";
    }

    // Files table fields
    if (firstRow.file_name !== undefined && firstRow.file_size !== undefined) {
      return "files";
    }

    // Signers table fields
    if (
      firstRow.signer_name !== undefined &&
      firstRow.signature_date !== undefined
    ) {
      return "signers";
    }

    // Clients table fields
    if (
      firstRow.document_number !== undefined ||
      firstRow.phone !== undefined ||
      firstRow.address !== undefined ||
      firstRow.IBAN !== undefined
    ) {
      return "clients";
    }

    // Tramites table fields
    if (
      firstRow.tramite_id !== undefined &&
      firstRow.tramite_type !== undefined
    ) {
      return "tramites";
    }
  }

  // Default to general_data for complex queries or mixed data
  return "general_data";
}

// Function to transform raw database comparativas data to ComparativaVM format
function transformComparativaData(
  rawData: Record<string, unknown>[]
): ComparativaVM[] {
  return rawData.map((row) => {
    // Handle potential null/undefined values safely
    const parsePlan = (planData: unknown): ComparativaPlan[] => {
      if (typeof planData === "string") {
        try {
          return JSON.parse(planData);
        } catch {
          return [];
        }
      }
      return Array.isArray(planData) ? planData : [];
    };

    const parseNotes = (notesData: unknown): string[] => {
      if (typeof notesData === "string") {
        try {
          return JSON.parse(notesData);
        } catch {
          return [];
        }
      }
      return Array.isArray(notesData) ? notesData : [];
    };

    return {
      id: String(row.id || ""),
      client: String(row.client || ""),
      service: String(row.service || "Luz") as "Luz" | "Gas",
      plan: parsePlan(row.plan),
      comision: {
        fijo: Number(row.comision_fijo || 0),
        indexado: Number(row.comision_indexado || 0),
      },
      comision_sales_person: {
        fijo: Number(row.comision_sales_person_fijo || 0),
        indexado: Number(row.comision_sales_person_indexado || 0),
      },
      notes: parseNotes(row.notes),
      user: {
        id: String(row.user_id || ""),
        name: String(row.name || ""),
        email: String(row.email || ""),
        image: row.image ? String(row.image) : null,
      },
      creation_date: String(row.creation_date || ""),
      status: String(row.status || "pending") as
        | "pending"
        | "completed"
        | "processed"
        | "rejected",
      tramite_id: row.tramite_id ? String(row.tramite_id) : undefined,
      files: [], // Files are not included in chatbot queries
    };
  });
}

// Utility functions for suggestions
function getSuggestionsByDataType(dataType: DataType): readonly string[] {
  return SUGGESTIONS[dataType] || SUGGESTIONS.general_data;
}

function getGeneralSuggestions(): readonly string[] {
  return SUGGESTIONS.general;
}

function getFallbackSuggestions(): readonly string[] {
  return SUGGESTIONS.fallback;
}

function getErrorSuggestions(): readonly string[] {
  return SUGGESTIONS.error;
}

function validateMessage(message: string): boolean {
  return Boolean(message?.trim());
}

// Database query execution
async function executeQuery(
  req: NextRequest,
  sqlQuery: string
): Promise<Record<string, unknown>[]> {
  const tursoClient = getTursoClient(req);
  if (!tursoClient) {
    throw new Error("Database client not initialized");
  }

  const result = await tursoClient.execute({ sql: sqlQuery });
  return result.rows as Record<string, unknown>[];
}

// Response builders
function buildDatabaseResponse(
  naturalResponse: string,
  data: Record<string, unknown>[],
  dataType: DataType,
  originalQuery: string
): ChatbotResponse {
  const response: ChatbotResponse = {
    response: naturalResponse,
    tableData: data,
    queryType: "database",
    originalQuery,
    dataType,
    suggestions: getSuggestionsByDataType(dataType),
  };

  // Transform comparativas data if needed
  if (dataType === "comparativas") {
    response.tableData = transformComparativaData(data);
  }

  return response;
}

function buildGeneralResponse(response: string): ChatbotResponse {
  return {
    response,
    queryType: "general",
    suggestions: getGeneralSuggestions(),
  };
}

function buildErrorResponse(
  message: string,
  suggestions: readonly string[]
): ChatbotResponse {
  return {
    response: message,
    suggestions,
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let currentUserId = "";
  let currentUserRole = "";

  try {
    // Verify session and extract user information
    const { session } = await verifySession(req);
    const { message, conversationHistory, super_id }: ChatbotRequest =
      await req.json(); // Extract user information for security logging
    currentUserId = session.user.id || "";
    currentUserRole = session.user.role || "";
    const currentUserSuperId = super_id;
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Comprehensive security validation
    const securityValidation = await ChatbotSecurity.validateRequest(
      req,
      currentUserId,
      currentUserRole
    );
    if (!securityValidation.isValid) {
      const response = NextResponse.json(
        buildErrorResponse(
          securityValidation.errors.includes("Rate limit exceeded")
            ? ERROR_MESSAGES.rateLimitExceeded
            : ERROR_MESSAGES.unauthorizedAccess,
          []
        ),
        {
          status: securityValidation.errors.includes("Rate limit exceeded")
            ? 429
            : 403,
          headers: SECURITY_HEADERS,
        }
      );

      if (securityValidation.retryAfter) {
        response.headers.set(
          "Retry-After",
          securityValidation.retryAfter.toString()
        );
      }

      return response;
    }

    // Validate and sanitize input
    const inputValidation = await ChatbotSecurity.validateAndSanitizeInput(
      message,
      conversationHistory,
      currentUserId,
      ip
    );

    if (!inputValidation.isValid) {
      SecurityAuditLogger.logSuspiciousPattern(
        currentUserId,
        ip,
        "Input validation failed",
        inputValidation.errors.join(", ")
      );

      return NextResponse.json(
        buildErrorResponse(ERROR_MESSAGES.invalidInput, []),
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Use sanitized inputs
    const sanitizedMessage = inputValidation.sanitizedMessage;
    const sanitizedHistory = inputValidation.sanitizedHistory;

    // Basic validation (keeping existing logic)
    if (!validateMessage(sanitizedMessage)) {
      return NextResponse.json(
        buildErrorResponse(ERROR_MESSAGES.emptyMessage, []),
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Validate user information
    if (!currentUserId || !currentUserRole) {
      SecurityAuditLogger.logUnauthorizedAccess(
        currentUserId || "unknown",
        currentUserRole || "unknown",
        ip,
        "Missing user information"
      );

      return NextResponse.json(
        buildErrorResponse(ERROR_MESSAGES.userInfo, []),
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Check if this is a database query
    if (isDataQuery(sanitizedMessage)) {
      try {
        // Debug logging with security context
        console.log("🔍 Chatbot API Debug:", {
          currentUserId,
          currentUserRole,
          currentUserSuperId,
          sanitizedMessage,
          requestDuration: Date.now() - startTime,
        });

        // Generate SQL query using Ollama
        const userContext: UserContext = {
          id: currentUserId,
          role: currentUserRole,
          superId: currentUserSuperId,
        };

        const sqlQuery = await Promise.race([
          ollamaService.generateSQLQuery(
            sanitizedMessage,
            userContext,
            sanitizedHistory
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("AI response timeout")), 45000)
          ),
        ]);

        console.log("User query:", sanitizedMessage);
        console.log("Generated SQL:", sqlQuery);
        console.log("SQL length:", sqlQuery.length);
        console.log("SQL preview:", sqlQuery.substring(0, 100) + "...");

        // Enhanced SQL security validation
        const sqlValidation = ChatbotSecurity.validateSQLQuery(
          sqlQuery,
          currentUserId,
          currentUserRole,
          ip
        );
        if (!sqlValidation.isValid) {
          return NextResponse.json(
            buildErrorResponse(
              ERROR_MESSAGES.unsafeQuery,
              SUGGESTIONS.unsafeQuery
            ),
            { status: 400, headers: SECURITY_HEADERS }
          );
        }

        // Use sanitized SQL
        const sanitizedSQL = sqlValidation.sanitizedSQL;

        // Execute query with timeout
        const data = await Promise.race([
          executeQuery(req, sanitizedSQL),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Database query timeout")), 30000)
          ),
        ]);

        console.log("Query executed successfully, rows returned:", data.length);

        // Log successful database access for audit
        console.log("🔒 Security Audit: Database access", {
          userId: currentUserId,
          userRole: currentUserRole,
          ip,
          queryType: "database",
          resultCount: data.length,
          timestamp: new Date().toISOString(),
        });

        // Generate response
        const dataType = detectDataType(sanitizedSQL, data, sanitizedMessage);
        const naturalResponse = await ollamaService.generateResponse(
          sanitizedMessage,
          data,
          sanitizedHistory
        );

        const response = buildDatabaseResponse(
          naturalResponse,
          data,
          dataType,
          sanitizedMessage
        );

        return NextResponse.json(response, { headers: SECURITY_HEADERS });
      } catch (error) {
        console.error("Database query error:", error);

        // Enhanced error handling with security logging
        if (error instanceof Error) {
          if (error.message.includes("timeout")) {
            SecurityAuditLogger.logSuspiciousPattern(
              currentUserId,
              ip,
              "Query timeout",
              sanitizedMessage
            );

            return NextResponse.json(
              buildErrorResponse(
                ERROR_MESSAGES.queryTooComplex,
                getFallbackSuggestions()
              ),
              { headers: SECURITY_HEADERS }
            );
          }

          if (error.message.includes("conectar con Ollama")) {
            return NextResponse.json(
              buildErrorResponse(
                ERROR_MESSAGES.ollamaConnection,
                SUGGESTIONS.ollamaConnection
              ),
              { headers: SECURITY_HEADERS }
            );
          }
        }

        // Generic database error fallback
        return NextResponse.json(
          buildErrorResponse(
            ERROR_MESSAGES.databaseAccess,
            getFallbackSuggestions()
          ),
          { headers: SECURITY_HEADERS }
        );
      }
    }

    // Handle general queries with security logging
    console.log("🔒 Security Audit: General query", {
      userId: currentUserId,
      userRole: currentUserRole,
      ip,
      queryType: "general",
      timestamp: new Date().toISOString(),
    });

    return await handleGeneralQuery(sanitizedMessage, sanitizedHistory);
  } catch (error) {
    console.error("Chatbot API error:", error);

    // Security logging for unhandled errors
    if (currentUserId) {
      const ip =
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "unknown";
      SecurityAuditLogger.logSuspiciousPattern(
        currentUserId,
        ip,
        "Unhandled error",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return NextResponse.json(
      buildErrorResponse(ERROR_MESSAGES.internalError, getErrorSuggestions()),
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}

// Separate function for handling general queries
async function handleGeneralQuery(
  message: string,
  conversationHistory?: ConversationMessage[]
): Promise<NextResponse> {
  try {
    const generalPrompt = GENERAL_QUERY_PROMPT.replace("{message}", message);

    const response = await ollamaService.generateGeneralResponse(
      generalPrompt,
      conversationHistory
    );

    return NextResponse.json(buildGeneralResponse(response), {
      headers: SECURITY_HEADERS,
    });
  } catch (error) {
    console.error("General query error:", error);
    return NextResponse.json(
      buildErrorResponse(
        ERROR_MESSAGES.generalFallback,
        getFallbackSuggestions()
      ),
      { headers: SECURITY_HEADERS }
    );
  }
}
