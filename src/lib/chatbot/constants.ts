// Chatbot constants and configuration

export const DATABASE_QUERY_KEYWORDS = [
  // Tramites
  "tramites",
  "trámites",
  "tramite",
  "trámite",
  // Clients
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
] as const;

export const SUGGESTIONS = {
  clients: [
    "Busca información de otro cliente",
    "¿Cuántos clientes hay en total?",
    "Muestra el historial completo de un cliente",
    "¿Qué clientes no tienen trámites?",
  ],
  comparativas: [
    "¿Cuántos estudios hay en proceso?",
    "Muestra los estudios completados",
    "¿Cuál es el estado de estos estudios?",
    "Busca estudios por cliente específico",
  ],
  fotovoltaica: [
    "¿Cuántos proyectos están activos?",
    "Muestra los proyectos completados",
    "¿Cuál es el estado de estos proyectos?",
    "Busca proyectos por ubicación",
  ],
  tramites: [
    "¿Cuántos hay en total?",
    "Muestra más detalles sobre estos",
    "¿Cuál es el estado de estos trámites?",
    "Busca trámites por cliente específico",
  ],
  contracts: [
    "¿Cuántos contratos hay activos?",
    "Muestra contratos por comercializadora",
    "¿Cuál es el consumo promedio?",
    "Busca contratos por ubicación",
  ],
  users: [
    "¿Cuántos usuarios hay activos?",
    "Muestra usuarios por rol",
    "¿Quiénes son los comerciales?",
    "Busca usuarios por empresa",
  ],
  files: [
    "¿Cuántos archivos hay subidos?",
    "Muestra archivos por tipo",
    "¿Cuáles son los archivos más recientes?",
    "Busca archivos por tamaño",
  ],
  signers: [
    "¿Cuántos firmantes hay registrados?",
    "Muestra firmantes por cliente",
    "¿Quiénes tienen firma pendiente?",
    "Busca firmantes por cargo",
  ],
  general_data: [
    "¿Cuántos hay en total?",
    "Muestra más detalles sobre estos",
    "¿Cuál es el estado de estos elementos?",
    "Busca elementos específicos",
  ],
  general: [
    "Explícame las tarifas eléctricas actuales",
    "¿Cómo cambio de comercializadora?",
    "¿Qué es el PVPC?",
    "Documentos necesarios para un alta",
  ],
  fallback: [
    "Explícame qué tipo de información necesitas",
    "¿Puedes reformular tu consulta?",
    "Háblame sobre el proceso de trámites",
    "¿Qué documentos sueles necesitar?",
  ],
  error: [
    "Explícame el proceso de trámites",
    "¿Cómo funciona el sector energético?",
    "Ayúdame con documentación",
    "Información sobre comisiones",
  ],
  ollamaConnection: [
    "Verificar que Ollama esté ejecutándose",
    "Explicar el problema a soporte técnico",
    "Usar la búsqueda manual en la página de trámites",
    "Consultar información general sobre energía",
  ],
  unsafeQuery: [
    "Haz una consulta que solo requiera leer datos",
    "Evita pedir cambios o eliminaciones de datos",
    "Consulta información sobre clientes, trámites, etc.",
  ],
} as const;

export const ERROR_MESSAGES = {
  emptyMessage: "Por favor, escribe tu consulta.",
  userInfo:
    "No se pudo obtener la información del usuario. Por favor, inicia sesión de nuevo.",
  unsafeQuery:
    "La consulta generada no es segura o no es una consulta SELECT. Por favor, reformula tu pregunta.",
  ollamaConnection:
    "No puedo conectar con el sistema de procesamiento de consultas (Ollama). Por favor, asegúrate de que Ollama esté ejecutándose y vuelve a intentarlo.",
  databaseAccess:
    "No pude acceder a los datos en este momento. Si me das más detalles sobre lo que buscas, tal vez pueda ayudarte de otra manera o sugerir alternativas.",
  generalFallback:
    "Gracias por tu consulta. En este momento no puedo procesarla completamente, pero estaré encantado de ayudarte con información sobre el sector energético, trámites o cualquier duda comercial que tengas.",
  internalError:
    "Ha ocurrido un error interno. Por favor, inténtalo de nuevo en unos momentos.",
  rateLimitExceeded:
    "Has excedido el límite de consultas permitidas. Por favor, espera antes de enviar otra consulta.",
  invalidInput:
    "Tu consulta contiene caracteres o patrones no permitidos. Por favor, reformula tu pregunta.",
  unauthorizedAccess:
    "No tienes permisos para realizar esta consulta. Contacta con el administrador si crees que esto es un error.",
  queryTooComplex:
    "La consulta generada es demasiado compleja. Por favor, intenta hacer una pregunta más específica.",
  sessionExpired:
    "Tu sesión ha expirado por razones de seguridad. Por favor, vuelve a iniciar sesión.",
} as const;

export const GENERAL_QUERY_PROMPT = `Eres un asistente experto en el sector energético español y gestión comercial. 
Responde de manera profesional y útil a esta consulta: "{message}"

Proporciona información precisa y actualizada sobre:
- Mercado energético español
- Tarifas y precios de energía
- Proceso de cambio de comercializadora
- Documentación necesaria para trámites
- Normativas energéticas
- Gestión comercial del sector

Mantén un tono profesional pero cercano.`;
