"use client";

import { useCallback } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { elegantSlideEffect } from "./view-transitions";

// Interface para opciones del slide effect
interface SlideEffectOptions {
  /** Callback ejecutado antes de la animación */
  onBeforeTransition?: () => void;
  /** Callback ejecutado después de la animación */
  onAfterTransition?: () => void;
  /** Habilitar debugging */
  debug?: boolean;
}

// Interface del valor de retorno del hook
interface UseSlideEffectReturn {
  /** Navegar a una ruta con efecto slide */
  navigateWithSlide: (route: string, options?: SlideEffectOptions) => void;
  /** Activar efecto slide manualmente (sin navegación) */
  triggerSlideEffect: (options?: SlideEffectOptions) => void;
}

/**
 * Hook personalizado para usar el efecto slide elegante en navegación
 *
 * @example
 * ```tsx
 * const { navigateWithSlide } = useSlideEffect();
 *
 * const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
 *   e.preventDefault();
 *   navigateWithSlide('/dashboard', {
 *     debug: true
 *   });
 * };
 * ```
 */
export function useSlideEffect(): UseSlideEffectReturn {
  const router = useTransitionRouter();

  const triggerSlideEffect = useCallback((options: SlideEffectOptions = {}) => {
    const { onBeforeTransition, onAfterTransition } = options;

    if (onBeforeTransition) {
      onBeforeTransition();
    }

    // Ejecutar efecto slide
    elegantSlideEffect();

    if (onAfterTransition) {
      // Ejecutar callback después de que termine la animación
      const SLIDE_DURATION = 800; // Actualizado para coincidir con la nueva duración
      setTimeout(onAfterTransition, SLIDE_DURATION);
    }
  }, []);

  const navigateWithSlide = useCallback(
    (route: string, options: SlideEffectOptions = {}) => {
      const { onBeforeTransition, onAfterTransition, debug } = options;

      router.push(route, {
        onTransitionReady: () => {
          triggerSlideEffect({
            onBeforeTransition,
            onAfterTransition,
            debug,
          });
        },
      });
    },
    [router, triggerSlideEffect]
  );

  return {
    navigateWithSlide,
    triggerSlideEffect,
  };
}

/**
 * Hook simplificado para elementos del sidebar
 * Detecta automáticamente la ruta del elemento clickeado
 *
 * @example
 * ```tsx
 * const handleSidebarClick = useSidebarSlideNavigation();
 *
 * <a href="/dashboard" onClick={handleSidebarClick} data-sidebar-item="/dashboard">
 *   Dashboard
 * </a>
 * ```
 */
export function useSidebarSlideNavigation() {
  const { navigateWithSlide } = useSlideEffect();

  return useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      const target = event.currentTarget;
      const route =
        target.getAttribute("data-sidebar-item") || target.getAttribute("href");

      if (!route) {
        console.warn(
          "🚨 Slide Effect: No route found in data-sidebar-item or href"
        );
        return;
      }

      navigateWithSlide(route, {
        debug: process.env.NODE_ENV === "development",
      });
    },
    [navigateWithSlide]
  );
}

export default useSlideEffect;
