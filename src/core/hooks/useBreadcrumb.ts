"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { routeConfig, RouteConfig } from "@/core/config/routes";
import { LucideIcon } from "lucide-react";

export interface BreadcrumbItem {
  href: string;
  title: string;
  icon?: LucideIcon;
  isCurrentPage: boolean;
  category?: string;
  description?: string;
}

interface ExtendedRouteConfig extends RouteConfig {
  dynamicValues?: Record<string, string>;
}

export const useBreadcrumb = () => {
  const pathname = usePathname();

  const breadcrumbItems = useMemo(() => {
    // Función para encontrar la configuración de ruta más específica
    const findRouteConfig = (path: string): ExtendedRouteConfig | null => {
      // Primero intentar coincidencia exacta
      if (routeConfig[path]) {
        return routeConfig[path];
      }

      // Luego intentar coincidencia con segmentos dinámicos
      const pathSegments = path.split("/").filter(Boolean);

      for (const [configPath, config] of Object.entries(routeConfig)) {
        const configSegments = configPath.split("/").filter(Boolean);

        if (pathSegments.length !== configSegments.length) {
          continue;
        }

        let matches = true;
        const dynamicValues: Record<string, string> = {};

        for (let i = 0; i < configSegments.length; i++) {
          const configSegment = configSegments[i];
          const pathSegment = pathSegments[i];

          if (configSegment.startsWith("[") && configSegment.endsWith("]")) {
            // Segmento dinámico
            const paramName = configSegment.slice(1, -1);
            if (paramName.startsWith("...")) {
              // Catch-all route
              const actualParamName = paramName.slice(3);
              dynamicValues[actualParamName] = pathSegments.slice(i).join("/");
              break;
            } else {
              dynamicValues[paramName] = pathSegment;
            }
          } else if (configSegment !== pathSegment) {
            matches = false;
            break;
          }
        }

        if (matches) {
          return { ...config, dynamicValues };
        }
      }

      return null;
    };

    // Construir la cadena de breadcrumb
    const buildBreadcrumbChain = (currentPath: string): BreadcrumbItem[] => {
      const chain: BreadcrumbItem[] = [];
      const config = findRouteConfig(currentPath);

      if (!config) {
        // Fallback para rutas no configuradas
        const segments = currentPath.split("/").filter(Boolean);
        let accumulatedPath = "";

        // Siempre incluir el Dashboard
        chain.push({
          href: "/",
          title: "Dashboard",
          icon: routeConfig["/"]?.icon,
          isCurrentPage: currentPath === "/",
          category: "principal",
        });

        // Añadir segmentos de la ruta actual
        segments.forEach((segment) => {
          accumulatedPath += `/${segment}`;
          const isCurrentPage = accumulatedPath === currentPath;

          chain.push({
            href: accumulatedPath,
            title: segment.charAt(0).toUpperCase() + segment.slice(1),
            isCurrentPage,
          });
        });

        return chain;
      }

      // Si hay una ruta padre, construir recursivamente
      if (config.parent && config.parent !== currentPath) {
        chain.push(...buildBreadcrumbChain(config.parent));
      }

      // Resolver título dinámico si es necesario
      let resolvedTitle = config.title;
      if (config.dynamicValues && config.dynamicSegments) {
        for (const [param, value] of Object.entries(config.dynamicValues)) {
          if (config.dynamicSegments[param]) {
            try {
              const resolver = config.dynamicSegments[param];
              resolvedTitle =
                typeof resolver === "function"
                  ? (resolver(value) as string)
                  : resolver;
            } catch (error) {
              console.warn(`Error resolving dynamic segment ${param}:`, error);
              resolvedTitle = `${config.title} #${value}`;
            }
          }
        }
      }

      // Añadir la página actual
      chain.push({
        href: currentPath,
        title: resolvedTitle,
        icon: config.icon,
        isCurrentPage: true,
        category: config.category,
        description: config.description,
      });

      return chain;
    };

    const chain = buildBreadcrumbChain(pathname);

    // Marcar solo la última página como actual
    return chain.map((item, index) => ({
      ...item,
      isCurrentPage: index === chain.length - 1,
    }));
  }, [pathname]);

  // Función para obtener información contextual
  const getContextInfo = useMemo(() => {
    const currentConfig = Object.entries(routeConfig).find(([path]) => {
      if (path === pathname) return true;

      // Verificar rutas dinámicas
      const pathSegments = pathname.split("/").filter(Boolean);
      const configSegments = path.split("/").filter(Boolean);

      if (pathSegments.length !== configSegments.length) return false;

      return configSegments.every((segment, index) => {
        if (segment.startsWith("[") && segment.endsWith("]")) return true;
        return segment === pathSegments[index];
      });
    })?.[1];

    return {
      currentPage:
        currentConfig?.title || pathname.split("/").pop() || "Página",
      category: currentConfig?.category,
      description: currentConfig?.description,
      icon: currentConfig?.icon,
    };
  }, [pathname]);

  return {
    items: breadcrumbItems,
    contextInfo: getContextInfo,
    currentPath: pathname,
  };
};
