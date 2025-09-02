"use client";

// Interfaz para definir la posición y estado del icono origen
interface IconPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  sidebarState: "expanded" | "collapsed";
}

// Función auxiliar para detectar el estado del sidebar
function getSidebarState(): "expanded" | "collapsed" {
  const sidebar = document.querySelector("[data-sidebar]");
  if (!sidebar) return "expanded";

  // Verificar si el sidebar está colapsado basándose en su atributo data-state
  const state = sidebar.getAttribute("data-state");
  return state === "collapsed" ? "collapsed" : "expanded";
}

// Función auxiliar para calcular la posición exacta del icono
function calculateIconPosition(sourceElement: HTMLElement): IconPosition {
  const rect = sourceElement.getBoundingClientRect();
  const sidebarState = getSidebarState();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
    sidebarState,
  };
}

// Efecto Genie Mejorado - Con posicionamiento preciso y timing optimizado
export function genieEffectAuthentic(sourceElement?: HTMLElement) {
  // Configuración de duraciones auténticas - Basadas en macOS real
  const CONTRACTION_DURATION = 550; // Minimizar: como macOS real
  const EXPANSION_DURATION = 400; // Restaurar: más rápido, como macOS

  // Cubic-bezier auténticos basados en las curvas reales de macOS
  // Sin bounce artificial, comportamiento más realista
  const PULL_EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"; // Ease-out-quad auténtico
  const RELEASE_EASING = "cubic-bezier(0.165, 0.84, 0.44, 1)"; // Ease-out-quart auténtico

  let iconPosition: IconPosition;

  if (sourceElement) {
    iconPosition = calculateIconPosition(sourceElement);
  } else {
    // Fallback: posición por defecto
    iconPosition = {
      x: 50,
      y: 200,
      width: 40,
      height: 40,
      sidebarState: "expanded",
    };
  }

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Calcular posición relativa del icono como punto de origen (más preciso)
  const originX = (iconPosition.x / windowWidth) * 100;
  const originY = (iconPosition.y / windowHeight) * 100;

  // Calcular offset desde el centro de la ventana hacia el icono
  const centerX = windowWidth / 2;
  const centerY = windowHeight / 2;
  const offsetX = iconPosition.x - centerX;
  const offsetY = iconPosition.y - centerY;

  console.log(
    `🎯 Genie Effect - Icon Position: ${iconPosition.x}, ${iconPosition.y}`,
    {
      sidebar: iconPosition.sidebarState,
      origin: `${originX.toFixed(1)}%, ${originY.toFixed(1)}%`,
      offset: `${offsetX}px, ${offsetY}px`,
    }
  );

  // ANIMACIÓN DE SALIDA: Contracción hacia el icono con efecto "pull"
  const contractionAnimation = document.documentElement.animate(
    [
      // Estado inicial: Ventana completa
      {
        opacity: 1,
        clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        transform: `scale(1, 1) translate(0px, 0px)`,
        transformOrigin: `${originX}% ${originY}%`,
      },
      // Paso 1: Inicio del efecto embudo - lado izquierdo empieza a contraerse
      {
        opacity: 0.95,
        clipPath: "polygon(5% 10%, 100% 0%, 100% 100%, 5% 90%)",
        transform: `scale(0.98, 0.95) translate(${offsetX * 0.03}px, ${offsetY * 0.03}px)`,
        transformOrigin: `${originX}% ${originY}%`,
        offset: 0.2, // 20% del tiempo
      },
      // Paso 2: Embudo más pronunciado - lado izquierdo se estrecha más
      {
        opacity: 0.85,
        clipPath: "polygon(12% 20%, 100% 5%, 100% 95%, 12% 80%)",
        transform: `scale(0.92, 0.85) translate(${offsetX * 0.08}px, ${offsetY * 0.08}px)`,
        transformOrigin: `${originX}% ${originY}%`,
        offset: 0.4, // 40% del tiempo
      },
      // Paso 3: Embudo marcado - forma de embudo horizontal clara
      {
        opacity: 0.85,
        clipPath: "polygon(25% 30%, 95% 10%, 95% 90%, 25% 70%)",
        transform: `scale(0.8, 0.7) translate(${offsetX * 0.2}px, ${offsetY * 0.2}px)`,
        transformOrigin: `${originX}% ${originY}%`,
        offset: 0.6, // 60% del tiempo
      },
      // Paso 4: Embudo extremo - boca muy pequeña a la izquierda
      {
        opacity: 0.8,
        clipPath: "polygon(40% 40%, 85% 20%, 85% 80%, 40% 60%)",
        transform: `scale(0.6, 0.45) translate(${offsetX * 0.5}px, ${offsetY * 0.5}px)`,
        transformOrigin: `${originX}% ${originY}%`,
        offset: 0.85, // 85% del tiempo
      },
      // Estado final: Colapso completo en el icono (punto en el lado izquierdo)
      {
        opacity: 0,
        clipPath: "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)",
        transform: `scale(0.05, 0.02) translate(${offsetX}px, ${offsetY}px)`,
        transformOrigin: `${originX}% ${originY}%`,
      },
    ],
    {
      duration: CONTRACTION_DURATION,
      easing: PULL_EASING,
      fill: "forwards",
      pseudoElement: "::view-transition-old(main-content)",
    }
  );

  // ANIMACIÓN DE ENTRADA: Se ejecuta DESPUÉS de que termine la de salida
  contractionAnimation.addEventListener("finish", () => {
    document.documentElement.animate(
      [
        // Estado inicial: Colapso en el icono (punto en el lado izquierdo)
        {
          opacity: 0,
          clipPath: "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)",
          transform: `scale(0.05, 0.02) translate(${offsetX}px, ${offsetY}px)`,
          transformOrigin: `${originX}% ${originY}%`,
        },
        // Paso 1: Expansión inicial - pequeño embudo se forma
        {
          opacity: 0.6,
          clipPath: "polygon(45% 45%, 65% 40%, 65% 60%, 45% 55%)",
          transform: `scale(0.15, 0.1) translate(${offsetX * 0.9}px, ${offsetY * 0.9}px)`,
          transformOrigin: `${originX}% ${originY}%`,
          offset: 0.15, // 15% del tiempo
        },
        // Paso 2: Embudo se expande - boca izquierda se agranda
        {
          opacity: 0.75,
          clipPath: "polygon(35% 35%, 75% 25%, 75% 75%, 35% 65%)",
          transform: `scale(0.4, 0.3) translate(${offsetX * 0.7}px, ${offsetY * 0.7}px)`,
          transformOrigin: `${originX}% ${originY}%`,
          offset: 0.4, // 40% del tiempo
        },
        // Paso 3: Embudo se nivela - forma menos pronunciada
        {
          opacity: 0.75,
          clipPath: "polygon(20% 25%, 85% 15%, 85% 85%, 20% 75%)",
          transform: `scale(0.7, 0.6) translate(${offsetX * 0.4}px, ${offsetY * 0.4}px)`,
          transformOrigin: `${originX}% ${originY}%`,
          offset: 0.7, // 70% del tiempo
        },
        // Paso 4: Casi rectangular - embudo se desvanece
        {
          opacity: 1,
          clipPath: "polygon(8% 8%, 95% 5%, 95% 95%, 8% 92%)",
          transform: `scale(0.95, 0.9) translate(${offsetX * 0.1}px, ${offsetY * 0.1}px)`,
          transformOrigin: `${originX}% ${originY}%`,
          offset: 0.9, // 90% del tiempo
        },
        // Estado final: Ventana completamente normal
        {
          opacity: 1,
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          transform: `scale(1, 1) translate(0px, 0px)`,
          transformOrigin: `${originX}% ${originY}%`,
        },
      ],
      {
        duration: EXPANSION_DURATION,
        easing: RELEASE_EASING,
        fill: "forwards",
        pseudoElement: "::view-transition-new(main-content)",
      }
    );
  });
}
