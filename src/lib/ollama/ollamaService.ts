import { Ollama } from "ollama";

export interface DatabaseSchema {
  clients: {
    id: string;
    name: string;
    last_name: string;
    type: string;
    email: string;
    phone: string;
    IBAN: string;
    document_type: string;
    document_number: string;
    address: string;
    postal_code: string;
    province: string;
    city: string;
    coordinates: string;
  };
  tramites: {
    id: string;
    creation_date: string;
    tramitation_date: string;
    activation_date: string;
    renovation_date: string;
    sales_name: string;
    comision_sales_person: number;
    comision: number;
    status: string;
    liquidez_status: string | null;
    notes: string;
    client_id: string;
    user_id: string;
    updated_by: string | null;
    updated_at: string | null;
    collection_date: string | null;
    payment_date: string | null;
    rejected_date: string | null;
    internal_notes: string | null;
  };
  contracts: {
    id: string;
    type: string;
    province: string;
    city: string;
    address: string;
    postal_code: string;
    old_company: string;
    new_company: string;
    plan: string;
    consumption: number;
    CUPS: string;
    pot1: number;
    pot2: number;
    pot3: number;
    pot4: number;
    pot5: number;
    pot6: number;
    description: string | null;
    tramite_id: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    email_verified: boolean;
    image: string | null;
    created_at: string;
    updated_at: string;
    role: string | null;
    banned: boolean | null;
    ban_reason: string | null;
    ban_expires: string | null;
    super_id: string | null;
    should_reset_password: number;
    company: string | null;
  };
  comparativas: {
    id: string;
    client: string;
    service: "Luz" | "Gas";
    plan: string;
    comision_fijo: number;
    comision_indexado: number;
    comision_sales_person_fijo: number;
    comision_sales_person_indexado: number;
    notes: string | null;
    user_id: string;
    creation_date: string;
    status: string;
    tramite_id: string | null;
  };
  fotovoltaica: {
    id: string;
    type: string;
    client: string;
    client_type: string;
    location: string;
    coordinates: string | null;
    creation_date: string;
    activation_date: string | null;
    status: string;
    notes: string | null;
    internal_notes: string | null;
    user_id: string;
    comision: number;
    comision_sales_person: number;
    updated_by: string | null;
    updated_at: string | null;
  };
  signers: {
    id: string;
    name: string;
    last_name: string;
    email: string;
    phone: string;
    document_number: string;
    cargo: string | null;
    client_id: string;
  };
  tramite_files: {
    id: string;
    tramite_id: string;
    filename: string;
    size: number;
    extension: string;
    upload_date: string;
    download_url: string;
    preview_url: string | null;
  };
  comparativa_files: {
    id: string;
    comparativa_id: string;
    filename: string;
    size: number;
    extension: string;
    upload_date: string;
    download_url: string;
    preview_url: string | null;
  };
  fotovoltaica_files: {
    id: string;
    fotovoltaica_id: string;
    filename: string;
    size: number | null;
    extension: string | null;
    upload_date: string | null;
    download_url: string | null;
    preview_url: string | null;
  };
}

// Status translations from Spanish (user input) to English (database values)
const STATUS_TRANSLATIONS = {
  comparativas: {
    "pendiente de estudio": "pending",
    pendiente: "pending",
    pendientes: "pending",
    "estudio realizado": "completed",
    realizado: "completed",
    realizadas: "completed",
    completada: "processed",
    completadas: "processed",
    procesada: "processed",
    procesadas: "processed",
    terminada: "processed",
    terminadas: "processed",
    rechazada: "rejected",
    rechazadas: "rejected",
  },
  fotovoltaica: {
    pendiente: "pending",
    pendientes: "pending",
    procesando: "processing",
    "en proceso": "processing",
    completado: "completed",
    completados: "completed",
    completada: "completed",
    completadas: "completed",
    terminado: "completed",
    terminados: "completed",
    terminada: "completed",
    terminadas: "completed",
    rechazada: "rejected",
    rechazadas: "rejected",
  },
};

// Function to preprocess query and translate Spanish status terms to English database values
const preprocessQuery = (query: string): string => {
  let processedQuery = query.toLowerCase();

  // Check if query mentions comparativas/estudios energéticos
  if (
    processedQuery.includes("comparativa") ||
    processedQuery.includes("estudio") ||
    processedQuery.includes("energético")
  ) {
    Object.entries(STATUS_TRANSLATIONS.comparativas).forEach(
      ([spanish, english]) => {
        const regex = new RegExp(`\\b${spanish}\\b`, "gi");
        processedQuery = processedQuery.replace(regex, english);
      }
    );
  }

  // Check if query mentions fotovoltaica/placas solares
  if (
    processedQuery.includes("fotovoltaica") ||
    processedQuery.includes("placa") ||
    processedQuery.includes("solar")
  ) {
    Object.entries(STATUS_TRANSLATIONS.fotovoltaica).forEach(
      ([spanish, english]) => {
        const regex = new RegExp(`\\b${spanish}\\b`, "gi");
        processedQuery = processedQuery.replace(regex, english);
      }
    );
  }

  return processedQuery;
};

const DATABASE_SCHEMA_PROMPT = `
Eres un experto en SQL para un CRM energético. Genera consultas SQL simples y directas. La base de datos está alojada en Turso con LibSQL.

🔍 IDENTIFICACIÓN DE TABLAS:
- "estudios energéticos" → tabla comparativas
- "estudios fotovoltaicos" o "placas solares" → tabla fotovoltaica  
- "trámites" → tabla tramites
- "clientes" → tabla clients

📋 ESQUEMA DE TABLAS:

TABLA comparativas:
- id, client (nombre completo), service, plan, notes, status, user_id, creation_date
- Estados en BD: pending, completed, processed, rejected
- Estados en español: "Pendiente de Estudio", "Estudio Realizado", "Completada", "Rechazada"

TABLA fotovoltaica:
- id, client (nombre completo), type, location, notes, status, user_id, creation_date, activation_date
- Estados en BD: pending, processing, completed, rejected  
- Estados en español: "Pendiente", "Procesando", "Completado", "Rechazada"

TABLA tramites:
- id, client_id (FK), user_id (FK), status, sales_name, creation_date, activation_date, renovation_date, collection_date, payment_date, comision_sales_person, comision, notes, liquidez_status
- Estados: Borrador, Verificado, Procesando, Pendiente de Firma, Activo, Baja, Cancelado
- Estados de liquidez: Pendiente de Cobro, Cobrado por Comercializadora, Pagado al Comercial, Descontado, Pendiente de Descontar

TABLA clients:
- id, name, last_name, email, phone, address, city, province

📅 FILTROS POR FECHAS (LibSQL/SQLite):
Para consultas con fechas, usar la función date() de SQLite:
- Fecha específica: WHERE date(creation_date) = date('2025-01-15')
- Rango de fechas: WHERE date(creation_date) BETWEEN date('2025-01-01') AND date('2025-01-31')
- Últimos 30 días: WHERE date(creation_date) >= date('now', '-30 days')
- Este año: WHERE date(creation_date) >= date('now', 'start of year')
- Este mes: WHERE date(creation_date) >= date('now', 'start of month')
- Esta semana: WHERE date(creation_date) >= date('now', 'weekday 0', '-6 days')

⚠️ IMPORTANTE: Estamos en 2025. Cuando el usuario mencione "junio", "enero", etc., sin especificar año, usa 2025.

FECHAS DISPONIBLES POR TABLA:
- tramites: creation_date, activation_date, renovation_date, collection_date, payment_date
- comparativas: creation_date
- fotovoltaica: creation_date, activation_date

🎯 EJEMPLOS CON FECHAS:

"trámites creados este mes" → SELECT t.*, (c.name || ' ' || c.last_name) AS client_name FROM tramites t LEFT JOIN clients c ON t.client_id = c.id WHERE date(t.creation_date) >= date('now', 'start of month') ORDER BY t.creation_date DESC LIMIT 50

"trámites activados en junio 2025" → SELECT t.*, (c.name || ' ' || c.last_name) AS client_name FROM tramites t LEFT JOIN clients c ON t.client_id = c.id WHERE date(t.activation_date) BETWEEN date('2025-06-01') AND date('2025-06-30') ORDER BY t.activation_date DESC LIMIT 50

"estudios energéticos de los últimos 30 días" → SELECT * FROM comparativas WHERE date(creation_date) BETWEEN date('now', '-30 days') AND date('now') ORDER BY creation_date DESC LIMIT 50

"fotovoltaica activada este año" → SELECT * FROM fotovoltaica WHERE date(activation_date) >= date('now', 'start of year') ORDER BY activation_date DESC LIMIT 50

🎯 EJEMPLOS PARA ADMIN/BACKOFFICE (SIN FILTROS DE USER_ID):

"trámites activos" → SELECT t.*, (c.name || ' ' || c.last_name) AS client_name FROM tramites t LEFT JOIN clients c ON t.client_id = c.id WHERE t.status = 'Activo' ORDER BY t.creation_date DESC LIMIT 50
"estudios energéticos" → SELECT * FROM comparativas ORDER BY creation_date DESC LIMIT 50
"estudios de placas solares" → SELECT * FROM fotovoltaica ORDER BY creation_date DESC LIMIT 50
"todos los clientes" → SELECT * FROM clients ORDER BY name LIMIT 50

🎯 EJEMPLOS CON FILTROS DE ESTADO:

"comparativas con estado estudio realizado" → SELECT * FROM comparativas WHERE status = 'completed' ORDER BY creation_date DESC LIMIT 50
"comparativas completadas" → SELECT * FROM comparativas WHERE status = 'processed' ORDER BY creation_date DESC LIMIT 50
"comparativas rechazadas" → SELECT * FROM comparativas WHERE status = 'rejected' ORDER BY creation_date DESC LIMIT 50
"comparativas pendientes de estudio" → SELECT * FROM comparativas WHERE status = 'pending' ORDER BY creation_date DESC LIMIT 50

"fotovoltaica completada" → SELECT * FROM fotovoltaica WHERE status = 'completed' ORDER BY creation_date DESC LIMIT 50
"fotovoltaica procesando" → SELECT * FROM fotovoltaica WHERE status = 'processing' ORDER BY creation_date DESC LIMIT 50
"fotovoltaica rechazada" → SELECT * FROM fotovoltaica WHERE status = 'rejected' ORDER BY creation_date DESC LIMIT 50
"fotovoltaica pendiente" → SELECT * FROM fotovoltaica WHERE status = 'pending' ORDER BY creation_date DESC LIMIT 50

🎯 EJEMPLOS PARA COMERCIAL (CON FILTROS DE USER_ID OBLIGATORIOS):

"mis trámites activos" → SELECT t.*, (c.name || ' ' || c.last_name) AS client_name FROM tramites t LEFT JOIN clients c ON t.client_id = c.id WHERE t.user_id = 'COMERCIAL_ID' AND t.status = 'Activo' ORDER BY t.creation_date DESC LIMIT 50

"mis estudios energéticos" → SELECT * FROM comparativas WHERE user_id = 'COMERCIAL_ID' ORDER BY creation_date DESC LIMIT 50

⚠️ IMPORTANTE:
- comparativas.client ya tiene el nombre completo (NO usar JOIN con clients)
- fotovoltaica.client ya tiene el nombre completo (NO usar JOIN con clients)  
- tramites SÍ necesita JOIN con clients (tiene client_id)
- NUNCA crear JOINs entre comparativas y fotovoltaica (son independientes)
- Para fechas, SIEMPRE usar la función date() de SQLite
- Las fechas están en formato ISO (YYYY-MM-DD)
- "trámites activos" = status = 'Activo' (sin filtro de fecha)
- "trámites activados en junio" = date(activation_date) BETWEEN date('2025-06-01') AND date('2025-06-30')
- Cuando el usuario dice "mis trámites" SIEMPRE aplicar el filtro de user_id

🔄 TRADUCCIÓN DE ESTADOS (ESPAÑOL → INGLÉS BD):

COMPARATIVAS:
- "Pendiente de Estudio" / "Pendiente" → pending
- "Estudio Realizado" / "Realizado" → completed  
- "Completada" / "Procesada" → processed
- "Rechazada" → rejected

FOTOVOLTAICA:
- "Pendiente" → pending
- "Procesando" / "En Proceso" → processing
- "Completado" / "Terminado" → completed
- "Rechazada" → rejected

⚠️ IMPORTANTE: Cuando el usuario mencione estados en español, TRADUCIR al valor inglés de la BD

Responde SOLO con la consulta SQL, sin explicaciones adicionales.
`;

export class OllamaService {
  private static instance: OllamaService;
  private ollama: Ollama;
  private initialized = false;

  /**
   * OllamaService handles conversational AI interactions for the CRM chatbot.
   * It maintains conversation context to provide coherent follow-up responses.
   *
   * Features:
   * - SQL query generation with conversation context
   * - Data response generation with conversation awareness
   * - General responses that consider previous conversation
   * - Context-aware follow-up question handling
   */
  private constructor() {
    this.ollama = new Ollama({ host: "http://127.0.0.1:11434" });
  }

  public static getInstance(): OllamaService {
    if (!OllamaService.instance) {
      OllamaService.instance = new OllamaService();
    }
    return OllamaService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection to Ollama
      await this.ollama.list();
      this.initialized = true;
    } catch (error) {
      console.error("Error connecting to Ollama:", error);
      throw new Error(
        "No se puede conectar con Ollama. Asegúrate de que esté ejecutándose."
      );
    }
  }

  private cleanSqlResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.trim();

    // Remove ```sql and ``` markers
    if (cleaned.startsWith("```sql")) {
      cleaned = cleaned.replace(/^```sql\s*/, "");
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "");
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.replace(/\s*```$/, "");
    }

    return cleaned.trim();
  }
  async generateSQLQuery(
    naturalLanguageQuery: string,
    userId: string,
    userRole: string,
    userSuperId?: string | null,
    conversationHistory?: {
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }[]
  ): Promise<string> {
    await this.initialize();
    // Preprocess query to translate Spanish status terms to English database values
    const processedQuery = preprocessQuery(naturalLanguageQuery);

    // Debug logging for status translation
    // Uncomment for debugging only
    // if (processedQuery !== naturalLanguageQuery.toLowerCase()) {
    //   console.log("🔄 Status Translation Applied:", {
    //     original: naturalLanguageQuery,
    //     processed: processedQuery,
    //   });
    // }

    let userContext = "";

    // Debug logging
    // Uncomment for debugging only
    // console.log("🔍 User Role Filter Debug:", {
    //   userId,
    //   userRole,
    //   userSuperId,
    // });

    // The role system uses string "2" for comercial roles and "admin" for admin roles
    if (userRole === "2") {
      if (userSuperId) {
        // Subcomercial: solo sus propios datos
        userContext = `
🚨🚨🚨 FILTRO CRÍTICO OBLIGATORIO 🚨🚨🚨
El usuario es SUBCOMERCIAL con ID: ${userId}
REGLA INFLEXIBLE: TODA consulta SQL DEBE incluir:
- Para tramites: WHERE t.user_id = '${userId}' AND [otros_filtros]
- Para comparativas: WHERE user_id = '${userId}' AND [otros_filtros]  
- Para fotovoltaica: WHERE user_id = '${userId}' AND [otros_filtros]
🚨 SIN EXCEPCIONES - ESTE FILTRO ES MANDATORY 🚨`;
      } else {
        // Comercial: sus datos + de sus subcomerciales
        userContext = `
🚨🚨🚨 FILTRO CRÍTICO OBLIGATORIO 🚨🚨🚨
El usuario es COMERCIAL con ID: ${userId}
REGLA INFLEXIBLE: TODA consulta SQL DEBE incluir:
- Para tramites: WHERE (t.user_id = '${userId}' OR t.user_id IN (SELECT id FROM user WHERE super_id = '${userId}')) AND [otros_filtros]
- Para comparativas: WHERE (user_id = '${userId}' OR user_id IN (SELECT id FROM user WHERE super_id = '${userId}')) AND [otros_filtros]
- Para fotovoltaica: WHERE (user_id = '${userId}' OR user_id IN (SELECT id FROM user WHERE super_id = '${userId}')) AND [otros_filtros]
🚨 SIN EXCEPCIONES - ESTE FILTRO ES MANDATORY 🚨`;
      }
    } else {
      // Admin/Backoffice: puede ver todo - NO aplicar filtros de usuario
      userContext = `
✅ USUARIO ADMIN/BACKOFFICE DETECTADO
El usuario tiene permisos de administrador (role: ${userRole})
🚫 NO APLICAR FILTROS DE USER_ID - El usuario puede ver todos los datos
🚫 NO incluir WHERE user_id = ... en ninguna consulta
🚫 NO filtrar por user_id bajo ninguna circunstancia
✅ FILTRO DE USUARIO: Ninguno - acceso completo a todos los datos`;
    }

    const prompt = `${userContext}

${DATABASE_SCHEMA_PROMPT}

${
  conversationHistory && conversationHistory.length > 0
    ? `
📚 CONTEXTO DE CONVERSACIÓN ANTERIOR:
${conversationHistory
  .slice(-6)
  .map(
    (msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
  )
  .join("\n")}

IMPORTANTE: Considera el contexto anterior para entender referencias como "los de ayer", "esos trámites", "el cliente anterior", etc.
`
    : ""
}

CONSULTA DEL USUARIO: "${processedQuery}"

🚨 ANTES DE GENERAR LA QUERY:
- Si es sobre COMPARATIVAS: usar SELECT * FROM comparativas (NO hacer JOIN con clients)
- Si es sobre FOTOVOLTAICA: usar SELECT * FROM fotovoltaica (NO hacer JOIN con clients)
- Si es sobre TRÁMITES: SÍ hacer JOIN con clients usando t.client_id

Genera una consulta SQL que responda a esta pregunta. La consulta debe:
1. 🔒 LEER Y APLICAR EL CONTEXTO DE USUARIO arriba (si aplica filtros o NO aplica filtros)
2. Si el usuario es ADMIN/BACKOFFICE: NO incluir filtros de user_id bajo ninguna circunstancia
3. Si el usuario es COMERCIAL/SUBCOMERCIAL: APLICAR OBLIGATORIAMENTE el filtro de user_id especificado
4. Seleccionar las columnas relevantes
5. Para comparativas y fotovoltaica: NO hacer JOIN con clients (ya tienen el nombre en la columna client)
6. Para trámites y contratos: SÍ hacer JOIN con clients cuando sea necesario
7. Combinar todos los filtros usando AND
8. Usar ORDER BY para ordenar los resultados ANTES de LIMIT
9. Limitar los resultados a máximo 50 filas con LIMIT

⚠️ RECORDATORIO CRÍTICO: 
- Si el contexto dice "NO APLICAR FILTROS DE USER_ID", entonces NO incluir user_id en el WHERE
- Si el contexto especifica un filtro de user_id, entonces SÍ incluirlo OBLIGATORIAMENTE

🚨 ESTRUCTURA SQL CORRECTA:
- Para ADMIN: SELECT ... FROM ... WHERE [solo_filtros_de_negocio] ORDER BY ... LIMIT ...
- Para COMERCIAL: SELECT ... FROM ... WHERE [filtro_user_id_obligatorio] AND [filtros_de_negocio] ORDER BY ... LIMIT ...

Responde SOLO con la consulta SQL, sin formato markdown:`;

    try {
      const response = await this.ollama.generate({
        model: "llama3.2", // You can change this to your preferred model
        prompt,
        stream: false,
      });

      const cleanedSql = this.cleanSqlResponse(response.response);
      return cleanedSql;
    } catch (error) {
      console.error("Error generating SQL query:", error);
      throw new Error("Error al generar la consulta SQL con Ollama");
    }
  }

  async generateResponse(
    query: string,
    data: Record<string, unknown>[],
    conversationHistory?: {
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }[]
  ): Promise<string> {
    await this.initialize();
    const prompt = `Eres un asistente de CRM energético. El usuario hizo esta consulta: "${query}"

${
  conversationHistory && conversationHistory.length > 0
    ? `
📚 CONTEXTO DE CONVERSACIÓN:
${conversationHistory
  .slice(-4)
  .map(
    (msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
  )
  .join("\n")}

Ten en cuenta este contexto para proporcionar una respuesta más coherente y personalizada.
`
    : ""
}

Los datos obtenidos son:
${JSON.stringify(data, null, 2)}

Genera una respuesta amigable que:
1. Resuma brevemente los resultados encontrados
2. Mencione el número de registros
3. Destaque información relevante si es apropiada
4. Use un tono profesional pero cercano

Si no hay resultados, sugiere posibles alternativas de búsqueda.

Respuesta:`;

    try {
      const response = await this.ollama.generate({
        model: "llama3.2",
        prompt,
        stream: false,
      });

      return response.response.trim();
    } catch (error) {
      console.error("Error generating response:", error);
      return `Encontré ${data.length} resultados para tu consulta.`;
    }
  }

  async generateGeneralResponse(
    prompt: string,
    conversationHistory?: {
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }[]
  ): Promise<string> {
    await this.initialize();

    const contextualPrompt =
      conversationHistory && conversationHistory.length > 0
        ? `${prompt}
      
📚 CONTEXTO DE CONVERSACIÓN:
${conversationHistory
  .slice(-4)
  .map(
    (msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
  )
  .join("\n")}

Ten en cuenta este contexto para proporcionar una respuesta más coherente y personalizada.`
        : prompt;

    try {
      const response = await this.ollama.generate({
        model: "llama3.2",
        prompt: contextualPrompt,
        stream: false,
      });

      return response.response.trim();
    } catch (error) {
      console.error("Error generating general response:", error);
      throw new Error("Error al generar respuesta con Ollama");
    }
  }
}

export const ollamaService = OllamaService.getInstance();
