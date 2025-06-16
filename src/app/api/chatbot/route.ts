import { NextRequest, NextResponse } from "next/server";

import { getTursoClient } from "@/lib/libsql/client";
import { getAuth } from "@/lib/auth/auth";
import { ComparativaVM, ComparativaPlan } from "@/lib/core/types";
import { ollamaService } from "@/lib/ollama/ollamaService";

interface ChatbotRequest {
  message: string;
  userId?: string;
  userRole?: string;
  userSuperId?: string | null;
  conversationHistory?: {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }[];
}

interface ChatbotResponse {
  response: string;
  suggestions?: string[];
  tableData?: Record<string, unknown>[] | ComparativaVM[];
  queryType?: "database" | "general";
  dataType?:
    | "tramites"
    | "clients"
    | "comparativas"
    | "fotovoltaica"
    | "contracts"
    | "users"
    | "files"
    | "signers"
    | "general_data";
  originalQuery?: string;
}

// Keywords that indicate a database query
const DATABASE_QUERY_KEYWORDS = [
  // Tramites
  "tramites",
  "trámites",
  "tramite",
  "trámite",
  // Clients
  "cliente",
  "clientes",
  "cliente",
  "clientes",
  // Comparativas
  "comparativa",
  "comparativas",
  "comparacion",
  "comparación",
  "tarifa",
  "tarifas",
  "estudio",
  "estudios",
  "estudio energético",
  "estudios energéticos",
  "estudio energetico",
  "estudios energeticos",
  // Fotovoltaica
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
  // Contracts
  "contrato",
  "contratos",
  "cups",
  "potencia",
  "consumo",
  // Files
  "archivo",
  "archivos",
  "documento",
  "documentos",
  "file",
  "files",
  // Signers
  "firmante",
  "firmantes",
  "signer",
  "signers",
  "firma",
  "firmas",
  // Users
  "usuario",
  "usuarios",
  "comercial",
  "comerciales",
  "admin",
  "backoffice",
  // General search terms
  "busca",
  "encuentra",
  "buscar",
  "encontrar",
  "mostrar",
  "muestra",
  "listar",
  "lista",
  "ver",
  "dame",
  "necesito",
  "quiero",
  // Status and states
  "activos",
  "activo",
  "pendientes",
  "estado",
  "status",
  "borrador",
  "verificado",
  "procesando",
  "baja",
  "cancelado",
  "completada",
  "completado",
  "estudio realizado",
  "realizado",
  "en proceso",
  "rechazado",
  "rechazada",
  "pendiente de estudio",
  "pendiente de cobro",
  "pendiente de firma",
  "cobrado por comercializadora",

  // Dates and time
  "junio",
  "julio",
  "agosto",
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
  "mes",
  "año",
  "fecha",
  "fechas",
  // Financial
  "comision",
  "comisión",
  "comisiones",
  "cobro",
  "pago",
  "liquidez",
  "iban",
  "factura",
  "facturas",
  // Company and business
  "empresa",
  "compañía",
  "plan",
  "planes",
  "servicio",
  "luz",
  "gas",
  "energia",
  "energía",
  // Location
  "direccion",
  "dirección",
  "ciudad",
  "provincia",
  "postal",
  "coordenadas",
  "ubicacion",
  "ubicación",
  // Contact info
  "información",
  "datos",
  "historial",
  "último",
  "ultima",
  "reciente",
  "contacto",
  "teléfono",
  "telefono",
  "email",
  "mail",
  // Document types
  "nombre",
  "apellido",
  "apellidos",
  "documento",
  "dni",
  "nif",
  "cif",
  "tipo",
  // Technical
  "creacion",
  "creación",
  "actualización",
  "update",
  "updated",
];

function isDataQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return DATABASE_QUERY_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );
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

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      userId,
      userRole,
      userSuperId,
      conversationHistory,
    }: ChatbotRequest = await req.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { response: "Por favor, escribe tu consulta." },
        { status: 400 }
      );
    }

    // Get user session using Better Auth
    const auth = getAuth(req);
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    const currentUserId = userId || session?.user?.id;
    const currentUserRole = userRole || session?.user?.role;
    // For now, get super_id from the request body as the session type doesn't include it
    const currentUserSuperId = userSuperId;

    if (!currentUserId || !currentUserRole) {
      return NextResponse.json(
        {
          response:
            "No se pudo verificar tu sesión. Por favor, inicia sesión de nuevo.",
        },
        { status: 401 }
      );
    } // Check if this is a database query
    if (isDataQuery(message)) {
      try {
        // Debug logging
        console.log("🔍 Chatbot API Debug:", {
          currentUserId,
          currentUserRole,
          currentUserSuperId,
          message,
        });

        // Generate SQL query using Ollama
        const sqlQuery = await ollamaService.generateSQLQuery(
          message,
          currentUserId,
          currentUserRole,
          currentUserSuperId,
          conversationHistory
        );

        console.log("User query:", message);
        console.log("Generated SQL:", sqlQuery);
        console.log("SQL length:", sqlQuery.length);
        console.log("SQL preview:", sqlQuery.substring(0, 100) + "...");

        // Validate the generated SQL to allow only SELECT statements
        const isSafeSelect =
          typeof sqlQuery === "string" &&
          /^\s*select\s+/i.test(sqlQuery) &&
          !/;\s*(drop|delete|update|insert|alter|create|replace|truncate|exec|call)\b/i.test(
            sqlQuery
          );

        if (!isSafeSelect) {
          return NextResponse.json(
            {
              response:
                "La consulta generada no es segura o no es una consulta SELECT. Por favor, reformula tu pregunta.",
              suggestions: [
                "Haz una consulta que solo requiera leer datos",
                "Evita pedir cambios o eliminaciones de datos",
                "Consulta información sobre clientes, trámites, etc.",
              ],
            },
            { status: 400 }
          );
        }

        // Execute the query
        const tursoClient = getTursoClient(req);
        if (!tursoClient) {
          throw new Error("Database client not initialized");
        }

        const result = await tursoClient.execute({ sql: sqlQuery });
        const data = result.rows as Record<string, unknown>[];

        console.log("Query executed successfully, rows returned:", data.length);

        // Detect data type (tramites or clients)
        const dataType = detectDataType(sqlQuery, data, message); // Generate a natural language response
        const naturalResponse = await ollamaService.generateResponse(
          message,
          data,
          conversationHistory
        ); // Dynamic suggestions based on data type
        const suggestions =
          dataType === "clients"
            ? [
                "Busca información de otro cliente",
                "¿Cuántos clientes hay en total?",
                "Muestra el historial completo de un cliente",
                "¿Qué clientes no tienen trámites?",
              ]
            : dataType === "comparativas"
              ? [
                  "¿Cuántos estudios hay en proceso?",
                  "Muestra los estudios completados",
                  "¿Cuál es el estado de estos estudios?",
                  "Busca estudios por cliente específico",
                ]
              : dataType === "fotovoltaica"
                ? [
                    "¿Cuántos proyectos están activos?",
                    "Muestra los proyectos completados",
                    "¿Cuál es el estado de estos proyectos?",
                    "Busca proyectos por ubicación",
                  ]
                : [
                    "¿Cuántos hay en total?",
                    "Muestra más detalles sobre estos",
                    "¿Cuál es el estado de estos trámites?",
                    "Busca trámites por cliente específico",
                  ];

        const response: ChatbotResponse = {
          response: naturalResponse,
          tableData: data,
          queryType: "database",
          originalQuery: message,
          dataType: dataType,
          suggestions: suggestions,
        };

        // If the data type is 'comparativas', transform the data to ComparativaVM format
        if (dataType === "comparativas") {
          response.tableData = transformComparativaData(data);
        }

        return NextResponse.json(response);
      } catch (error) {
        console.error("Database query error:", error);

        // If it's an Ollama connection error, provide specific message
        if (
          error instanceof Error &&
          error.message.includes("conectar con Ollama")
        ) {
          return NextResponse.json({
            response:
              "No puedo conectar con el sistema de procesamiento de consultas (Ollama). Por favor, asegúrate de que Ollama esté ejecutándose y vuelve a intentarlo.",
            suggestions: [
              "Verificar que Ollama esté ejecutándose",
              "Explicar el problema a soporte técnico",
              "Usar la búsqueda manual en la página de trámites",
              "Consultar información general sobre energía",
            ],
          });
        } // Fallback response for database errors
        return NextResponse.json({
          response:
            "No pude acceder a los datos en este momento. Si me das más detalles sobre lo que buscas, tal vez pueda ayudarte de otra manera o sugerir alternativas.",
          suggestions: [
            "Explícame qué tipo de información necesitas",
            "¿Puedes reformular tu consulta?",
            "Háblame sobre el proceso de trámites",
            "¿Qué documentos sueles necesitar?",
          ],
        });
      }
    }

    // Handle general queries with Ollama
    try {
      const generalPrompt = `Eres un asistente experto en el sector energético español y gestión comercial. 
      Responde de manera profesional y útil a esta consulta: "${message}"
      
      Proporciona información precisa y actualizada sobre:
      - Mercado energético español
      - Tarifas y precios de energía
      - Proceso de cambio de comercializadora
      - Documentación necesaria para trámites
      - Normativas energéticas
      - Gestión comercial del sector
      
      Mantén un tono profesional pero cercano.`;
      const response = await ollamaService.generateGeneralResponse(
        generalPrompt,
        conversationHistory
      );

      const chatbotResponse: ChatbotResponse = {
        response: response,
        queryType: "general",
        suggestions: [
          "Explícame las tarifas eléctricas actuales",
          "¿Cómo cambio de comercializadora?",
          "¿Qué es el PVPC?",
          "Documentos necesarios para un alta",
        ],
      };

      return NextResponse.json(chatbotResponse);
    } catch (error) {
      console.error("General query error:", error);

      // Fallback response
      return NextResponse.json({
        response:
          "Gracias por tu consulta. En este momento no puedo procesarla completamente, pero estaré encantado de ayudarte con información sobre el sector energético, trámites o cualquier duda comercial que tengas.",
        suggestions: [
          "¿Cómo puedo ayudarte con tus trámites?",
          "Información sobre tarifas energéticas",
          "Proceso de alta de cliente",
          "Estados de trámites explicados",
        ],
      });
    }
  } catch (error) {
    console.error("Chatbot API error:", error);

    return NextResponse.json(
      {
        response:
          "Ha ocurrido un error interno. Por favor, inténtalo de nuevo en unos momentos.",
        suggestions: [
          "Explícame el proceso de trámites",
          "¿Cómo funciona el sector energético?",
          "Ayúdame con documentación",
          "Información sobre comisiones",
        ],
      },
      { status: 500 }
    );
  }
}
