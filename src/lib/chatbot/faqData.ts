import { FAQ } from "./faqEngine";

export const faqData: FAQ[] = [
  {
    id: "faq-001",
    question: "¿Cómo puedo subir un nuevo contrato?",
    answer:
      "Pulsa el botón de 'Nuevo Trámite' desde el dashboard, la página de trámites o el menú de acceso rápido situado a la izquierda del menú de notificaciones.",
    keywords: [
      "subir contrato",
      "nuevo contrato",
      "crear contrato",
      "añadir contrato",
      "trámite nuevo",
      "dashboard trámites",
      "acceso rápido contrato",
    ],
    category: "tramites",
  },
  {
    id: "faq-002",
    question: "¿Cómo puedo solicitar un estudio energético?",
    answer:
      "Pulsa el botón de 'Crear comparativa' desde la página comparativas o desde el menú de acceso rápido situado a la izquierda del menú de notificaciones.",
    keywords: [
      "solicitar estudio",
      "estudio energético",
      "crear comparativa",
      "comparativa energética",
      "acceso rápido estudio",
      "informe consumo",
    ],
    category: "estudios",
  },
  {
    id: "faq-003",
    question: "¿Cómo se da de alta un nuevo cliente en el sistema?",
    answer:
      "Para registrar un nuevo cliente, primero debes iniciar un trámite. Pulsa el botón 'Nuevo Trámite' desde el dashboard, la página de trámites o el menú de acceso rápido. En el formulario del trámite podrás crear un nuevo cliente desde cero o seleccionar uno existente si ya está registrado.",
    keywords: [
      "alta cliente",
      "nuevo cliente",
      "registrar cliente",
      "crear cliente",
      "añadir cliente",
      "gestión de clientes",
      "nuevo trámite cliente",
    ],
    category: "clientes",
  },
  {
    id: "faq-004",
    question: "¿Dónde puedo ver las facturas subidas de un cliente?",
    answer:
      "Desde la página 'Clientes', selecciona el cliente que desees consultar. En su ficha, accede a la pestaña 'Archivos', donde encontrarás todos los documentos subidos, incluidas las facturas. Puedes utilizar los filtros para localizar archivos específicos.",
    keywords: [
      "ver facturas",
      "facturas cliente",
      "documentos cliente",
      "archivos subidos",
      "pestaña archivos",
      "consultar facturas",
    ],
    category: "clientes",
  },
  {
    id: "faq-005",
    question: "¿Cómo asigno un comercial a un trámite o comparativa?",
    answer:
      "Al iniciar cualquier trámite o comparativa, el primer paso es seleccionar el comercial responsable. Por defecto, los comerciales solo pueden asignarse a sí mismos. Los usuarios con rol de Dirección o BackOffice sí pueden asignar el trámite o comparativa a cualquier comercial dentro del equipo.",
    keywords: [
      "asignar comercial",
      "responsable trámite",
      "gestión de comerciales",
      "vincular comercial",
      "comparativa comercial",
      "dirección asignación",
    ],
    category: "tramites",
  },
  {
    id: "faq-006",
    question: "¿Cómo genero una comparativa entre comercializadoras?",
    answer:
      "Accede al módulo de comparativas, pulsa en 'Crear comparativa', selecciona el cliente, sube la factura y ajusta los parámetros de simulación.",
    keywords: [
      "generar comparativa",
      "comparativa comercializadoras",
      "crear comparativa",
      "módulo comparativas",
      "simulación factura",
      "analizar oferta",
    ],
    category: "comparativas",
  },
  {
    id: "faq-007",
    question: "¿Puedo ver todos los trámites activos de un cliente?",
    answer:
      "Sí, entra en la ficha del cliente y accede a la pestaña 'Trámites'. Verás todos los trámites en curso, su estado y responsable asignado.",
    keywords: [
      "trámites activos",
      "trámites cliente",
      "ver trámites",
      "estado trámite",
      "seguimiento cliente",
      "historial trámites",
    ],
    category: "clientes",
  },
  {
    id: "faq-008",
    question: "¿Cómo puedo subir documentación adicional de un cliente?",
    answer:
      "Los archivos no se adjuntan directamente al cliente, sino a cada trámite asociado. Para subir documentación, accede al trámite correspondiente y utiliza la opción 'Subir archivo'. Si creas un nuevo trámite para un cliente existente, durante el proceso podrás seleccionar también documentos ya subidos en trámites anteriores.",
    keywords: [
      "subir documentos",
      "documentación adicional",
      "adjuntar archivo",
      "archivos cliente",
      "subida documentación",
      "trámite archivos",
    ],
    category: "tramites",
  },
];
