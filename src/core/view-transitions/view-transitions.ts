"use client";

// Versión Push - Como iOS pero más fluida
export function pushSlideEffect() {
  const DURATION = 1100; // Aumentado para más elegancia
  const POWER4_IN_OUT = "cubic-bezier(0.76, 0, 0.24, 1)"; // Equivalente a power4.inOut

  // SALIDA: Se empuja hacia la izquierda
  document.documentElement.animate(
    [
      {
        opacity: 1,
        transform: "translateX(0%)",
        zIndex: 0,
        offset: 0,
      },
      {
        opacity: 0.75,
        transform: "translateX(-25%)",
        zIndex: 0,
        offset: 0.25,
      },
      {
        opacity: 0.5,
        transform: "translateX(-50%)",
        zIndex: 0,
        offset: 0.5,
      },
      {
        opacity: 0.25,
        transform: "translateX(-75%)",
        zIndex: 0,
        offset: 0.75,
      },
      {
        opacity: 0,
        transform: "translateX(-100%)",
        zIndex: 0,
        offset: 1,
      },
    ],
    {
      duration: DURATION,
      easing: POWER4_IN_OUT,
      fill: "forwards",
      pseudoElement: "::view-transition-old(main-content)",
    }
  );

  // ENTRADA: Empuja desde la derecha
  document.documentElement.animate(
    [
      {
        opacity: 0,
        transform: "translateX(100%)",
        background: "white",
        zIndex: 1,
        offset: 0,
      },
      {
        opacity: 0.25,
        transform: "translateX(75%)",
        background: "white",
        zIndex: 1,
        offset: 0.25,
      },
      {
        opacity: 0.5,
        transform: "translateX(50%)",
        background: "white",
        zIndex: 1,
        offset: 0.5,
      },
      {
        opacity: 0.75,
        transform: "translateX(25%)",
        background: "white",
        zIndex: 1,
        offset: 0.75,
      },

      {
        opacity: 1,
        transform: "translateX(0%)",
        background: "white",
        zIndex: 1,
        offset: 1,
      },
    ],
    {
      duration: DURATION,
      easing: POWER4_IN_OUT,
      fill: "forwards",
      pseudoElement: "::view-transition-new(main-content)",
    }
  );
}
