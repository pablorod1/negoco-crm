"use client";

// Efecto de Slide Elegante - Transición paso a paso más lenta y visual
export function elegantSlideEffect() {
  // Configuración mejorada con duraciones más largas y easing más elegante
  const TOTAL_DURATION = 1800; // Duración total más lenta para mejor percepción

  // Easing curves más sofisticados para diferentes fases
  const SMOOTH_EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)"; // Suave y elegante
  // const SCALE_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // Con pequeño bounce para escala
  // const SLIDE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)"; // Fluido para deslizamiento

  // ANIMACIÓN DE SALIDA: Transición gradual hacia la derecha
  document.documentElement.animate(
    [
      // Estado inicial: Pantalla normal (0%)
      {
        opacity: 1,
        transform: "scale(1) translateX(0%)",
        border: "2px solid rgba(0, 0, 0, 0.15)",
        borderRadius: "44px",
        filter: "brightness(1) blur(0px)",
        overflow: "hidden",
        offset: 0,
      },

      // FASE 1: Preparación - Ligero scale down (0-20%)
      {
        opacity: 1,
        transform: "scale(0.95) translateX(0%)",
        border: "2px solid rgba(0, 0, 0, 0.15)",
        borderRadius: "44px",
        filter: "brightness(0.98) blur(0px)",
        overflow: "hidden",
        offset: 0.2,
      },

      // FASE 2: Scale down más pronunciado (20-35%)
      {
        opacity: 1,
        transform: "scale(0.85) translateX(0%)",
        border: "2px solid rgba(0, 0, 0, 0.12)",
        borderRadius: "44px",
        filter: "brightness(0.96) blur(0.5px)",
        overflow: "hidden",
        offset: 0.35,
      },

      // FASE 3: Comenzar deslizamiento - momento de coexistencia (35-50%)
      {
        opacity: 1,
        transform: "scale(0.8) translateX(25%)",
        border: "2px solid rgba(0, 0, 0, 0.1)",
        borderRadius: "44px",
        filter: "brightness(0.94) blur(1px)",
        overflow: "hidden",
        offset: 0.45,
      },

      // PUNTO CLAVE: Momento de coexistencia lado a lado al 50% (50-55%)
      {
        opacity: 1,
        transform: "scale(0.8) translateX(60%)",
        border: "2px solid rgba(0, 0, 0, 0.08)",
        borderRadius: "44px",
        filter: "brightness(0.92) blur(1.5px)",
        overflow: "hidden",
        offset: 0.5, // Momento exacto de coexistencia
      },

      // FASE 4: Continuar deslizamiento hacia la derecha (55-75%)
      {
        opacity: 0.8,
        transform: "scale(0.75) translateX(95%)",
        border: "2px solid rgba(0, 0, 0, 0.05)",
        borderRadius: "44px",
        filter: "brightness(0.88) blur(2px)",
        overflow: "hidden",
        offset: 0.7,
      },

      // FASE 5: Salida final (75-100%)
      {
        opacity: 0,
        transform: "scale(0.7) translateX(130%)",
        border: "2px solid rgba(0, 0, 0, 0.02)",
        borderRadius: "44px",
        filter: "brightness(0.8) blur(3px)",
        overflow: "hidden",
        offset: 1,
      },
    ],
    {
      duration: TOTAL_DURATION,
      easing: SMOOTH_EASE,
      fill: "forwards",
      pseudoElement: "::view-transition-old(main-content)",
    }
  );

  // ANIMACIÓN DE ENTRADA: Entrada retrasada para evitar solapamiento
  document.documentElement.animate(
    [
      // Estado inicial: Fuera por la izquierda - RETRASO EXTENDIDO (0-42%)
      {
        opacity: 0,
        transform: "scale(0.7) translateX(-130%)",
        border: "2px solid rgba(0, 0, 0, 0.02)",
        borderRadius: "44px",
        filter: "brightness(0.8) blur(3px)",
        overflow: "hidden",
        offset: 0,
      },

      // Mantener fuera de vista más tiempo (42%)
      {
        opacity: 0,
        transform: "scale(0.7) translateX(-130%)",
        border: "2px solid rgba(0, 0, 0, 0.02)",
        borderRadius: "44px",
        filter: "brightness(0.8) blur(3px)",
        overflow: "hidden",
        offset: 0.42,
      },

      // Comenzar entrada gradual (42-48%)
      {
        opacity: 0.4,
        transform: "scale(0.75) translateX(-85%)",
        border: "2px solid rgba(0, 0, 0, 0.05)",
        borderRadius: "44px",
        filter: "brightness(0.88) blur(2px)",
        overflow: "hidden",
        offset: 0.48,
      },

      // PUNTO CLAVE: Momento de coexistencia lado a lado al 50% (48-52%)
      {
        opacity: 1,
        transform: "scale(0.8) translateX(-70%)",
        border: "2px solid rgba(0, 0, 0, 0.08)",
        borderRadius: "44px",
        filter: "brightness(0.92) blur(1.5px)",
        overflow: "hidden",
        offset: 0.52, // Momento exacto de coexistencia
      },

      // FASE 2: Continuar entrada hacia el centro (52-68%)
      {
        opacity: 1,
        transform: "scale(0.8) translateX(-50%)",
        border: "2px solid rgba(0, 0, 0, 0.1)",
        borderRadius: "44px",
        filter: "brightness(0.94) blur(1px)",
        overflow: "hidden",
        offset: 0.68,
      },

      // FASE 3: Llegar al centro (68-78%)
      {
        opacity: 1,
        transform: "scale(0.85) translateX(0%)",
        border: "2px solid rgba(0, 0, 0, 0.12)",
        borderRadius: "44px",
        filter: "brightness(0.96) blur(0.5px)",
        overflow: "hidden",
        offset: 0.78,
      },

      // FASE 4: Scale up gradual (78-88%)
      {
        opacity: 1,
        transform: "scale(0.95) translateX(0%)",
        border: "2px solid rgba(0, 0, 0, 0.15)",
        borderRadius: "44px",
        filter: "brightness(0.98) blur(0px)",
        overflow: "hidden",
        offset: 0.88,
      },

      // FASE 5: Estado final normal (88-100%)
      {
        opacity: 1,
        transform: "scale(1) translateX(0%)",
        border: "2px solid rgba(0, 0, 0, 0.15)",
        borderRadius: "44px",
        filter: "brightness(1) blur(0px)",
        overflow: "hidden",
        offset: 1,
      },
    ],
    {
      duration: TOTAL_DURATION,
      easing: SMOOTH_EASE,
      fill: "forwards",
      pseudoElement: "::view-transition-new(main-content)",
    }
  );
}
