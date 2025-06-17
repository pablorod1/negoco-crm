import { Ollama } from "ollama";

// Types and interfaces
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UserContext {
  id: string;
  role: string;
  superId?: string | null;
}

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

// Configuration constants
const OLLAMA_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2";
const MAX_CONVERSATION_CONTEXT = 6;
const MAX_GENERAL_CONTEXT = 4;

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
# CRM ENERGÉTICO - GENERADOR SQL EXPERTO

Eres un experto en SQL para un CRM energético. Genera consultas SQL optimizadas y precisas para LibSQL/SQLite (Turso).

## 🎯 CONTEXTO ACTUAL
- Año actual: 2025
- Base de datos: Turso (LibSQL/SQLite)
- Responde ÚNICAMENTE con la consulta SQL, sin explicaciones

## �️ MAPEO DE CONCEPTOS

### Términos del usuario → Tabla de BD:
- "estudios energéticos" / "comparativas" → **comparativas**
- "fotovoltaica" / "placas solares" / "estudios fotovoltaicos" → **fotovoltaica**
- "trámites" / "contratos" → **tramites**
- "clientes" / "personas" → **clients**
- "usuarios" / "comerciales" → **user**
- "contratos" / "información de suministro" → **contracts**
- "firmantes" / "signatarios" → **signers**
- "documentos" / "archivos" → **tramite_files**, **comparativa_files**, **fotovoltaica_files**

## � ESQUEMA DETALLADO DE TABLAS

### 🏢 **clients** (Información de clientes)
\`\`\`sql
id (TEXT, PK), name (TEXT, NOT NULL), last_name (TEXT, NOT NULL), 
type (TEXT, NOT NULL), email (TEXT, NOT NULL), phone (TEXT, NOT NULL), 
IBAN (TEXT, NOT NULL), document_type (TEXT, NOT NULL), 
document_number (TEXT, NOT NULL), address (TEXT, NOT NULL), 
postal_code (TEXT, DEFAULT ""), province (TEXT, DEFAULT ""), 
city (TEXT, DEFAULT ""), coordinates (TEXT, DEFAULT '""')
\`\`\`

### 📋 **tramites** (Trámites de contratación)
\`\`\`sql
id (TEXT, PK), client_id (TEXT, FK→clients.id), user_id (TEXT, FK→user.id),
creation_date (TEXT, NOT NULL), tramitation_date (TEXT, NOT NULL), 
activation_date (TEXT, NOT NULL), renovation_date (TEXT, NOT NULL),
collection_date (TEXT), payment_date (TEXT), rejected_date (TEXT),
sales_name (TEXT, NOT NULL), comision (REAL, NOT NULL), 
comision_sales_person (REAL, NOT NULL), status (TEXT, NOT NULL), 
liquidez_status (TEXT), notes (TEXT), internal_notes (TEXT), 
updated_by (TEXT, FK→user.id), updated_at (TEXT)
\`\`\`
**Estados válidos:** Borrador, Verificado, Procesando, Pendiente de Firma, Activo, Baja, Cancelado
**Estados liquidez:** Pendiente de Cobro, Cobrado por Comercializadora, Pagado al Comercial, Descontado, Pendiente de Descontar

### 🔍 **comparativas** (Estudios energéticos)
\`\`\`sql
id (TEXT, PK), client (TEXT, NOT NULL, nombre completo), 
service (TEXT, CHECK IN ('Luz', 'Gas'), NOT NULL),
plan (TEXT, NOT NULL), comision_fijo (REAL, NOT NULL), 
comision_indexado (REAL, NOT NULL), comision_sales_person_fijo (REAL, NOT NULL), 
comision_sales_person_indexado (REAL, NOT NULL), notes (TEXT), 
user_id (TEXT, NOT NULL, FK→user.id), creation_date (TEXT, NOT NULL),
status (TEXT, NOT NULL), tramite_id (TEXT, FK→tramites.id)
\`\`\`
**Estados BD:** pending, completed, processed, rejected
**Estados UI:** "Pendiente de Estudio", "Estudio Realizado", "Completada", "Rechazada"

### ☀️ **fotovoltaica** (Estudios fotovoltaicos)
\`\`\`sql
id (TEXT, PK), type (TEXT, DEFAULT 'PPA', NOT NULL), 
client (TEXT, NOT NULL, nombre completo), client_type (TEXT, DEFAULT 'Empresa', NOT NULL), 
location (TEXT, NOT NULL), coordinates (TEXT), creation_date (TEXT, NOT NULL), 
activation_date (TEXT), status (TEXT, NOT NULL), notes (TEXT), 
internal_notes (TEXT), user_id (TEXT, NOT NULL, FK→user.id),
comision (REAL, DEFAULT 0, NOT NULL), comision_sales_person (REAL, DEFAULT 0, NOT NULL), 
updated_by (TEXT), updated_at (TEXT)
\`\`\`
**Estados BD:** pending, processing, completed, rejected
**Estados UI:** "Pendiente", "Procesando", "Completado", "Rechazada"

### � **contracts** (Contratos asociados a trámites)
\`\`\`sql
id (TEXT, PK), type (TEXT, NOT NULL), province (TEXT, NOT NULL), 
city (TEXT, NOT NULL), address (TEXT, NOT NULL), postal_code (TEXT, NOT NULL), 
old_company (TEXT, DEFAULT ""), new_company (TEXT, NOT NULL), 
plan (TEXT, NOT NULL), consumption (INTEGER, DEFAULT 0), CUPS (TEXT, NOT NULL), 
pot1 (INTEGER, DEFAULT 0), pot2 (INTEGER, DEFAULT 0), pot3 (INTEGER, DEFAULT 0), 
pot4 (INTEGER, DEFAULT 0), pot5 (INTEGER, DEFAULT 0), pot6 (INTEGER, DEFAULT 0), 
description (TEXT), tramite_id (TEXT, FK→tramites.id)
\`\`\`

### 👥 **signers** (Firmantes de contratos)
\`\`\`sql
id (TEXT, PK), name (TEXT, NOT NULL), last_name (TEXT, NOT NULL), 
email (TEXT, NOT NULL), phone (TEXT, NOT NULL), 
document_number (TEXT, NOT NULL), cargo (TEXT), 
client_id (TEXT, NOT NULL, FK→clients.id)
\`\`\`

### �👤 **user** (Usuarios del sistema)
\`\`\`sql
id (TEXT, PK), name (TEXT, NOT NULL), email (TEXT, NOT NULL, UNIQUE), 
email_verified (BOOLEAN, NOT NULL), image (TEXT), 
created_at (TIMESTAMP, NOT NULL), updated_at (TIMESTAMP, NOT NULL), 
role (TEXT), banned (BOOLEAN), ban_reason (TEXT), ban_expires (TIMESTAMP),
super_id (TEXT, FK→user.id), should_reset_password (INTEGER, DEFAULT 1), 
company (TEXT)
\`\`\`

### 📎 **Tablas de archivos**
- **tramite_files**: id (PK), tramite_id (FK→tramites.id), filename (NOT NULL), size (INTEGER, NOT NULL), extension (NOT NULL), upload_date (DATETIME, DEFAULT CURRENT_TIMESTAMP), download_url (NOT NULL), preview_url
- **comparativa_files**: id (PK), comparativa_id (FK→comparativas.id), filename (NOT NULL), size (INTEGER, NOT NULL), extension (NOT NULL), upload_date (NOT NULL), download_url (NOT NULL), preview_url
- **fotovoltaica_files**: id (PK), fotovoltaica_id (FK→fotovoltaica.id), filename, size (REAL), extension, upload_date, download_url, preview_url

## 📅 MANEJO DE FECHAS (SQLite/LibSQL)

### Funciones de fecha esenciales:
- **Fecha específica:** \`date(field) = date('2025-06-15')\`
- **Rango:** \`date(field) BETWEEN date('2025-06-01') AND date('2025-06-30')\`
- **Relativos:** \`date(field) >= date('now', '-30 days')\`
- **Periodos:** \`date(field) >= date('now', 'start of month')\`

### Campos de fecha por tabla:
- **tramites:** creation_date, tramitation_date, activation_date, renovation_date, collection_date, payment_date, rejected_date
- **comparativas:** creation_date
- **fotovoltaica:** creation_date, activation_date
- **user:** created_at, updated_at

## 🔄 TRADUCCIÓN DE ESTADOS

### COMPARATIVAS (español → BD):
- "Pendiente de Estudio" / "Pendiente" → \`pending\`
- "Estudio Realizado" / "Realizado" → \`completed\`
- "Completada" / "Procesada" → \`processed\`
- "Rechazada" → \`rejected\`

### FOTOVOLTAICA (español → BD):
- "Pendiente" → \`pending\`
- "Procesando" / "En Proceso" → \`processing\`
- "Completado" / "Terminado" → \`completed\`
- "Rechazada" → \`rejected\`

## 🔗 REGLAS DE JOINS CRÍTICAS

### ✅ JOINS CORRECTOS:
- **tramites + clients:** \`tramites t LEFT JOIN clients c ON t.client_id = c.id\`
- **tramites + user:** \`tramites t LEFT JOIN user u ON t.user_id = u.id\`
- **tramites + contracts:** \`tramites t LEFT JOIN contracts ct ON t.id = ct.tramite_id\`
- **comparativas + user:** \`comparativas c LEFT JOIN user u ON c.user_id = u.id\`
- **comparativas + tramites:** \`comparativas c LEFT JOIN tramites t ON c.tramite_id = t.id\`
- **fotovoltaica + user:** \`fotovoltaica f LEFT JOIN user u ON f.user_id = u.id\`
- **clients + signers:** \`clients c LEFT JOIN signers s ON c.id = s.client_id\`
- **Archivos + entidades:** \`tramite_files tf LEFT JOIN tramites t ON tf.tramite_id = t.id\`

### ❌ JOINS PROHIBIDOS:
- **comparativas + clients** (client ya contiene nombre completo)
- **fotovoltaica + clients** (client ya contiene nombre completo)
- **comparativas + fotovoltaica** (son independientes)
- **contracts + clients directamente** (usar tramites como intermediario)

## 🎯 PATRONES DE CONSULTA COMUNES

### Para ADMIN/BACKOFFICE (sin filtros user_id):
\`\`\`sql
-- Todos los trámites activos
SELECT t.*, (c.name || ' ' || c.last_name) AS client_name 
FROM tramites t LEFT JOIN clients c ON t.client_id = c.id 
WHERE t.status = 'Activo' ORDER BY t.creation_date DESC LIMIT 50;

-- Todas las comparativas
SELECT * FROM comparativas ORDER BY creation_date DESC LIMIT 50;
\`\`\`

### Para COMERCIAL (con filtros user_id obligatorios):
\`\`\`sql
-- IMPORTANTE: Reemplazar USER_ID_VALUE con el ID real del usuario proporcionado en el contexto
-- Mis trámites activos
SELECT t.*, (c.name || ' ' || c.last_name) AS client_name 
FROM tramites t LEFT JOIN clients c ON t.client_id = c.id 
WHERE t.user_id = 'USER_ID_VALUE' AND t.status = 'Activo' 
ORDER BY t.creation_date DESC LIMIT 50;

-- Mis estudios energéticos
SELECT * FROM comparativas WHERE user_id = 'USER_ID_VALUE' 
ORDER BY creation_date DESC LIMIT 50;
\`\`\`

## 🚀 OPTIMIZACIONES

### Rendimiento:
- Usar **LIMIT** apropiado (default: 50, máximo: 100)
- **ORDER BY** por fecha más reciente primero
- Índices automáticos en PKs y FKs

### Nomenclatura consistente:
- Alias de tabla: \`t\` (tramites), \`c\` (clients), \`u\` (user), \`co\` (comparativas), \`f\` (fotovoltaica)
- Nombres de cliente: \`(c.name || ' ' || c.last_name) AS client_name\`

## ⚠️ REGLAS CRÍTICAS

1. **Fechas:** Siempre usar \`date()\` para comparaciones
2. **Estados:** Traducir español a inglés para BD
3. **Filtros de usuario:** Obligatorios para rol comercial
4. **Joins:** Respetar las reglas definidas arriba
5. **Límites:** Incluir LIMIT para evitar sobrecarga
6. **Formato:** Solo SQL, sin explicaciones adicionales

Responde ÚNICAMENTE con la consulta SQL optimizada.
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
   */ private constructor() {
    this.ollama = new Ollama({ host: OLLAMA_HOST });
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

  // Utility methods
  private buildUserContext({ id, role, superId }: UserContext): string {
    const debugLog = `
🔍 User Role Filter Debug: { userId: ${id}, userRole: ${role}, userSuperId: ${superId} }`;

    console.log(debugLog);

    switch (role) {
      case "2":
        return superId
          ? this.buildSubcommercialContext(id, superId)
          : this.buildCommercialContext(id);

      case "1":
      case "admin":
        return this.buildAdminContext(role);

      default:
        return this.buildUnknownRoleContext(id, role);
    }
  }

  private buildSubcommercialContext(userId: string, superId: string): string {
    return `
🚨🚨🚨 FILTRO CRÍTICO OBLIGATORIO 🚨🚨🚨
El usuario es SUBCOMERCIAL (role: "2" con super_id: ${superId}) - ID: ${userId}
REGLA INFLEXIBLE: TODA consulta SQL DEBE incluir:
- Para tramites: WHERE t.user_id = '${userId}' AND [otros_filtros]
- Para comparativas: WHERE user_id = '${userId}' AND [otros_filtros]  
- Para fotovoltaica: WHERE user_id = '${userId}' AND [otros_filtros]
🚨 SIN EXCEPCIONES - ESTE FILTRO ES MANDATORY 🚨`;
  }

  private buildCommercialContext(userId: string): string {
    return `
🚨🚨🚨 FILTRO CRÍTICO OBLIGATORIO 🚨🚨🚨
El usuario es COMERCIAL (role: "2" sin super_id) - ID: ${userId}
REGLA INFLEXIBLE: TODA consulta SQL DEBE incluir:
- Para tramites: WHERE (t.user_id = '${userId}' OR t.user_id IN (SELECT id FROM user WHERE super_id = '${userId}')) AND [otros_filtros]
- Para comparativas: WHERE (user_id = '${userId}' OR user_id IN (SELECT id FROM user WHERE super_id = '${userId}')) AND [otros_filtros]
- Para fotovoltaica: WHERE (user_id = '${userId}' OR user_id IN (SELECT id FROM user WHERE super_id = '${userId}')) AND [otros_filtros]
🚨 SIN EXCEPCIONES - ESTE FILTRO ES MANDATORY 🚨`;
  }

  private buildAdminContext(role: string): string {
    return `
✅ USUARIO CON PERMISOS COMPLETOS DETECTADO (role: "${role}")
El usuario tiene permisos completos (Backoffice/Admin) - ambos roles tienen los mismos permisos
🚫 NO APLICAR FILTROS DE USER_ID - El usuario puede ver todos los datos
🚫 NO incluir WHERE user_id = ... en ninguna consulta
🚫 NO filtrar por user_id bajo ninguna circunstancia
✅ FILTRO DE USUARIO: Ninguno - acceso completo a todos los datos`;
  }

  private buildUnknownRoleContext(userId: string, role: string): string {
    return `
⚠️ ROL DESCONOCIDO DETECTADO (role: "${role}")
Por seguridad, aplicando restricciones de COMERCIAL limitado
🚨 FILTRO CRÍTICO: WHERE user_id = '${userId}' (solo sus propios datos)
⚠️ Verificar configuración de roles en el sistema`;
  }

  private buildConversationContext(history: ConversationMessage[]): string {
    if (!history || history.length === 0) return "";

    return `
📚 CONTEXTO DE CONVERSACIÓN ANTERIOR:
${history
  .slice(-MAX_CONVERSATION_CONTEXT)
  .map(
    (msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
  )
  .join("\n")}

IMPORTANTE: Considera el contexto anterior para entender referencias como "los de ayer", "esos trámites", "el cliente anterior", etc.
`;
  }

  private async generateWithOllama(prompt: string): Promise<string> {
    const response = await this.ollama.generate({
      model: DEFAULT_MODEL,
      prompt,
      stream: false,
    });
    return response.response;
  }
  async generateSQLQuery(
    naturalLanguageQuery: string,
    userContext: UserContext,
    conversationHistory?: ConversationMessage[]
  ): Promise<string> {
    await this.initialize();

    // Preprocess query to translate Spanish status terms to English database values
    const processedQuery = preprocessQuery(naturalLanguageQuery);

    // Build user context and conversation context
    const userContextPrompt = this.buildUserContext(userContext);
    const conversationContext = this.buildConversationContext(
      conversationHistory || []
    );

    const prompt = `${userContextPrompt}

${DATABASE_SCHEMA_PROMPT}

${conversationContext}

CONSULTA DEL USUARIO: "${processedQuery}"

🚨 ANTES DE GENERAR LA QUERY:
- Si es sobre COMPARATIVAS: usar SELECT * FROM comparativas (NO hacer JOIN con clients)
- Si es sobre FOTOVOLTAICA: usar SELECT * FROM fotovoltaica (NO hacer JOIN con clients)
- Si es sobre TRÁMITES: SÍ hacer JOIN con clients usando t.client_id
- 🔒 LEER Y APLICAR EL CONTEXTO DE USUARIO arriba (si aplica filtros o NO aplica filtros)
- Si el usuario es ADMIN (role: "admin") o BACKOFFICE (role: "1"): NO incluir filtros de user_id bajo ninguna circunstancia
- Si el usuario es COMERCIAL (role: "2") o SUBCOMERCIAL (role: "2" + super_id): APLICAR OBLIGATORIAMENTE el filtro de user_id especificado

Genera una consulta SQL que responda a esta pregunta. La consulta debe:

1. USAR EL ID DE USUARIO REAL: Cuando el contexto especifica el ID del usuario (ej: ID: xyz123), usar ese valor exacto en la consulta, NO usar placeholders como 'USER_ID'
2. Seleccionar las columnas relevantes
3. Para comparativas y fotovoltaica: NO hacer JOIN con clients (ya tienen el nombre en la columna client)
4. Para trámites y contratos: SÍ hacer JOIN con clients cuando sea necesario
5. Combinar todos los filtros usando AND
6. Usar ORDER BY para ordenar los resultados ANTES de LIMIT
7. Limitar los resultados a máximo 50 filas con LIMIT

⚠️ RECORDATORIO CRÍTICO: 
- Si el contexto dice "NO APLICAR FILTROS DE USER_ID", entonces NO incluir user_id en el WHERE
- Si el contexto especifica un filtro de user_id, entonces SÍ incluirlo OBLIGATORIAMENTE
- NUNCA usar placeholders como 'USER_ID' - siempre usar el ID real proporcionado en el contexto

🚨 ESTRUCTURA SQL CORRECTA:
- Para ADMIN/BACKOFFICE: SELECT ... FROM ... WHERE [solo_filtros_de_negocio] ORDER BY ... LIMIT ...
- Para COMERCIAL/SUBCOMERCIAL: SELECT ... FROM ... WHERE [filtro_user_id_real] AND [filtros_de_negocio] ORDER BY ... LIMIT ...

Responde SOLO con la consulta SQL, sin formato markdown:`;

    try {
      const response = await this.generateWithOllama(prompt);
      return this.cleanSqlResponse(response);
    } catch (error) {
      console.error("Error generating SQL query:", error);
      throw new Error("Error al generar la consulta SQL con Ollama");
    }
  }
  async generateResponse(
    query: string,
    data: Record<string, unknown>[],
    conversationHistory?: ConversationMessage[]
  ): Promise<string> {
    await this.initialize();

    const conversationContext =
      conversationHistory && conversationHistory.length > 0
        ? `
📚 CONTEXTO DE CONVERSACIÓN:
${conversationHistory
  .slice(-MAX_GENERAL_CONTEXT)
  .map(
    (msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
  )
  .join("\n")}

Ten en cuenta este contexto para proporcionar una respuesta más coherente y personalizada.
`
        : "";

    const prompt = `Eres un asistente de CRM energético. El usuario hizo esta consulta: "${query}"

${conversationContext}

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
      const response = await this.generateWithOllama(prompt);
      return response.trim();
    } catch (error) {
      console.error("Error generating response:", error);
      return `Encontré ${data.length} resultados para tu consulta.`;
    }
  }

  async generateGeneralResponse(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<string> {
    await this.initialize();

    const contextualPrompt =
      conversationHistory && conversationHistory.length > 0
        ? `${prompt}
      
📚 CONTEXTO DE CONVERSACIÓN:
${conversationHistory
  .slice(-MAX_GENERAL_CONTEXT)
  .map(
    (msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`
  )
  .join("\n")}

Ten en cuenta este contexto para proporcionar una respuesta más coherente y personalizada.`
        : prompt;

    try {
      const response = await this.generateWithOllama(contextualPrompt);
      return response.trim();
    } catch (error) {
      console.error("Error generating general response:", error);
      throw new Error("Error al generar respuesta con Ollama");
    }
  }
}

export const ollamaService = OllamaService.getInstance();
