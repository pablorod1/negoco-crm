import {
  Home,
  ArrowRightLeft,
  ClipboardList,
  Wallet,
  Sun,
  BookUser,
  Factory,
  FolderOpen,
  Users,
  Megaphone,
  FileText,
  BarChart3,
  UserCircle,
  LucideIcon,
} from "lucide-react";
import { formatUUID } from "../utils/format";

export interface RouteConfig {
  path: string;
  title: string;
  icon?: LucideIcon;
  parent?: string;
  category?: string;
  description?: string;
  dynamicSegments?: {
    [key: string]: (id: string) => Promise<string> | string;
  };
}

export const routeConfig: Record<string, RouteConfig> = {
  // Dashboard
  "/": {
    path: "/",
    title: "Dashboard",
    icon: Home,
    category: "principal",
    description: "Panel principal del CRM",
  },

  // Operaciones
  "/comparativas": {
    path: "/comparativas",
    title: "Comparativas",
    icon: ArrowRightLeft,
    parent: "/",
    category: "operaciones",
    description: "Gestión de comparativas energéticas",
  },
  "/comparativas/[id]": {
    path: "/comparativas/[id]",
    title: "Detalle de Comparativa",
    parent: "/comparativas",
    category: "operaciones",
    dynamicSegments: {
      id: (id: string) => {
        // Aquí podrías hacer una llamada a la API para obtener el nombre real
        return `Comparativa #${formatUUID(id)}`;
      },
    },
  },
  "/tramites": {
    path: "/tramites",
    title: "Trámites",
    icon: ClipboardList,
    parent: "/",
    category: "operaciones",
    description: "Gestión y seguimiento de trámites",
  },
  "/tramites/[id]": {
    path: "/tramites/[id]",
    title: "Detalle de Trámite",
    parent: "/tramites",
    category: "operaciones",
    dynamicSegments: {
      id: (id: string) => `Trámite #${formatUUID(id)}`,
    },
  },
  "/liquidez": {
    path: "/liquidez",
    title: "Liquidaciones",
    icon: Wallet,
    parent: "/",
    category: "operaciones",
    description: "Registro y control de liquidaciones",
  },
  "/fotovoltaica": {
    path: "/fotovoltaica",
    title: "Fotovoltaica",
    icon: Sun,
    parent: "/",
    category: "operaciones",
    description: "Gestión de instalaciones solares",
  },
  "/fotovoltaica/[id]": {
    path: "/fotovoltaica/[id]",
    title: "Detalle de Instalación",
    parent: "/fotovoltaica",
    category: "operaciones",
    dynamicSegments: {
      id: (id: string) => `Instalación #${formatUUID(id)}`,
    },
  },

  // Gestión
  "/clientes": {
    path: "/clientes",
    title: "Clientes",
    icon: BookUser,
    parent: "/",
    category: "gestion",
    description: "Gestión y seguimiento de clientes",
  },
  "/clientes/[id]": {
    path: "/clientes/[id]",
    title: "Perfil de Cliente",
    parent: "/clientes",
    category: "gestion",
    dynamicSegments: {
      id: (id: string) => {
        // Aquí podrías obtener el nombre real del cliente
        return `Cliente #${formatUUID(id)}`;
      },
    },
  },
  "/comercializadoras": {
    path: "/comercializadoras",
    title: "Comercializadoras",
    icon: Factory,
    parent: "/",
    category: "gestion",
    description: "Gestión de proveedores energéticos",
  },
  "/comercializadoras/[id]": {
    path: "/comercializadoras/[id]",
    title: "Perfil de Comercializadora",
    parent: "/comercializadoras",
    category: "gestion",
    dynamicSegments: {
      id: (id: string) => `Comercializadora #${id}`,
    },
  },
  "/documentacion": {
    path: "/documentacion",
    title: "Documentación",
    icon: FolderOpen,
    parent: "/",
    category: "gestion",
    description: "Archivos y documentos asociados",
  },
  "/documentacion/[...path]": {
    path: "/documentacion/[...path]",
    title: "Carpeta",
    parent: "/documentacion",
    category: "gestion",
    dynamicSegments: {
      path: (path: string) => {
        // Formatear el path de la carpeta
        const segments = path.split("/").filter(Boolean);
        return segments[segments.length - 1] || "Carpeta";
      },
    },
  },
  "/colaboradores": {
    path: "/colaboradores",
    title: "Colaboradores",
    icon: Users,
    parent: "/",
    category: "gestion",
    description: "Control de usuarios y colaboradores",
  },
  "/difusiones": {
    path: "/difusiones",
    title: "Difusiones",
    icon: Megaphone,
    parent: "/",
    category: "gestion",
    description: "Comunicaciones y campañas informativas",
  },

  // Perfil
  "/perfil": {
    path: "/perfil",
    title: "Perfil",
    icon: UserCircle,
    parent: "/",
    category: "usuario",
    description: "Configuración del perfil de usuario",
  },
};

export const categoryLabels: Record<string, string> = {
  principal: "Principal",
  operaciones: "Operaciones",
  gestion: "Gestión",
  usuario: "Usuario",
};

export const categoryIcons: Record<string, LucideIcon> = {
  principal: Home,
  operaciones: BarChart3,
  gestion: FileText,
  usuario: UserCircle,
};
