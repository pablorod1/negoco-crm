"use client";

import { useCallback } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { genieEffectAuthentic } from "./view-transitions";

// Interface para opciones del genie effect
interface GenieEffectOptions {
  /** Elemento HTML del icono origen (detectado automáticamente si no se proporciona) */
  sourceElement?: HTMLElement;
  /** Callback ejecutado antes de la animación */
  onBeforeTransition?: () => void;
  /** Callback ejecutado después de la animación */
  onAfterTransition?: () => void;
  /** Habilitar debugging (mostrar posición del icono) */
  debug?: boolean;
}

// Interface del valor de retorno del hook
interface UseGenieEffectReturn {
  /** Navegar a una ruta con efecto genie */
  navigateWithGenie: (route: string, options?: GenieEffectOptions) => void;
  /** Activar efecto genie manualmente (sin navegación) */
  triggerGenieEffect: (options?: GenieEffectOptions) => void;
}

/**
 * Hook personalizado para usar el efecto genie de macOS en navegación
 *
 * @example
 * ```tsx
 * const { navigateWithGenie } = useGenieEffect();
 *
 * const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
 *   e.preventDefault();
 *   navigateWithGenie('/dashboard', {
 *     sourceElement: e.currentTarget,
 *     debug: true
 *   });
 * };
 * ```
 */
export function useGenieEffect(): UseGenieEffectReturn {
  const router = useTransitionRouter();

  const triggerGenieEffect = useCallback((options: GenieEffectOptions = {}) => {
    const { sourceElement, onBeforeTransition, onAfterTransition } = options;

    if (onBeforeTransition) {
      onBeforeTransition();
    }

    // Ejecutar efecto genie
    genieEffectAuthentic(sourceElement);

    if (onAfterTransition) {
      // Ejecutar callback después de que termine la animación
      const totalDuration = 550 + 400; // CONTRACTION_DURATION + EXPANSION_DURATION (950ms total - auténtico macOS)
      setTimeout(onAfterTransition, totalDuration);
    }
  }, []);

  const navigateWithGenie = useCallback(
    (route: string, options: GenieEffectOptions = {}) => {
      const { sourceElement, onBeforeTransition, onAfterTransition, debug } =
        options;

      // Auto-detectar sourceElement si no se proporciona
      let targetElement = sourceElement;
      if (!targetElement) {
        // Buscar el elemento del sidebar que corresponde a la ruta
        const sidebarItems = document.querySelectorAll("[data-sidebar-item]");
        for (const item of sidebarItems) {
          const href = (item as HTMLAnchorElement).getAttribute(
            "data-sidebar-item"
          );
          if (href === route) {
            targetElement = item as HTMLElement;
            break;
          }
        }
      }

      router.push(route, {
        onTransitionReady: () => {
          triggerGenieEffect({
            sourceElement: targetElement,
            onBeforeTransition,
            onAfterTransition,
            debug,
          });
        },
      });
    },
    [router, triggerGenieEffect]
  );

  return {
    navigateWithGenie,
    triggerGenieEffect,
  };
}

/**
 * Hook simplificado para elementos del sidebar
 * Detecta automáticamente el elemento clickeado y la ruta
 *
 * @example
 * ```tsx
 * const handleSidebarClick = useSidebarGenieNavigation();
 *
 * <a href="/dashboard" onClick={handleSidebarClick} data-sidebar-item="/dashboard">
 *   Dashboard
 * </a>
 * ```
 */
export function useSidebarGenieNavigation() {
  const { navigateWithGenie } = useGenieEffect();

  return useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      const target = event.currentTarget;
      const route =
        target.getAttribute("data-sidebar-item") || target.getAttribute("href");

      if (!route) {
        console.warn(
          "🚨 Genie Effect: No route found in data-sidebar-item or href"
        );
        return;
      }

      navigateWithGenie(route, {
        sourceElement: target,
        debug: process.env.NODE_ENV === "development",
      });
    },
    [navigateWithGenie]
  );
}

export default useGenieEffect;
