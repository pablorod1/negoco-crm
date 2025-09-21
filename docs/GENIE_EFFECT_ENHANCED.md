# 🎯 Genie Effect Mejorado - NextJS 15+ View Transitions

## 📖 Resumen de Mejoras Implementadas

### ✅ **1. Duración Auténtica (basada en macOS real)**
- **Contracción**: 550ms (minimizar como macOS)
- **Expansión**: 400ms (restaurar más rápido, como macOS)
- **Total**: 950ms para experiencia auténtica

### ✅ **2. Cubic-Bezier Auténticos (basados en macOS)**
- **Pull Effect**: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` - Ease-out-quad auténtico
- **Release Effect**: `cubic-bezier(0.165, 0.84, 0.44, 1)` - Ease-out-quart auténtico

### ✅ **3. Transformaciones No Uniformes**
- **Escala independiente**: `scale(X, Y)` - Aplastamiento vertical más pronunciado
- **Perspectiva dinámica**: 1000px → 100px para efecto de profundidad
- **Rotación sutil**: 0° → 20° en rotateX para curvatura característica

### ✅ **3. Posicionamiento Preciso**
- Cálculo exacto de coordenadas del icono origen
- Soporte para estados `expanded` / `collapsed` del sidebar
- Offset dinámico hacia el punto de origen
- Debug mode para desarrollo

### ✅ **4. Efectos Visuales Auténticos**
- **Sin bounce artificial** - Comportamiento realista como macOS
- **Perspectiva dinámica** - Efecto de profundidad característico
- **Aplastamiento vertical** - La ventana se "aplasta" como el genie real

---

## 🛠️ Uso Básico

### Método 1: Hook Simplificado (Recomendado)
```tsx
import { useSidebarGenieNavigation } from "@/core/view-transitions/useGenieEffect";

function SidebarItem({ href, children }) {
  const handleClick = useSidebarGenieNavigation();
  
  return (
    <a 
      href={href}
      onClick={handleClick}
      data-sidebar-item={href}
    >
      {children}
    </a>
  );
}
```

### Método 2: Hook Completo con Opciones
```tsx
import { useGenieEffect } from "@/core/view-transitions/useGenieEffect";

function CustomComponent() {
  const { navigateWithGenie } = useGenieEffect();
  
  const handleNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    
    navigateWithGenie('/dashboard', {
      sourceElement: e.currentTarget,
      debug: true, // Solo en desarrollo
      onBeforeTransition: () => console.log('Iniciando...'),
      onAfterTransition: () => console.log('Completado!')
    });
  };
  
  return (
    <button onClick={handleNavigation}>
      Navegar con Genie Effect
    </button>
  );
}
```

---

## 🎨 Configuración CSS

### Clases CSS Optimizadas
```css
/* Estilos automáticamente aplicados */
::view-transition-old(main-content),
::view-transition-new(main-content) {
  transform-style: preserve-3d;
  perspective: 1200px;
  will-change: transform, opacity, clip-path;
  image-rendering: optimize-contrast;
}

/* Debug mode (opcional) */
.debug-genie-effect {
  position: fixed;
  background: rgba(255, 0, 0, 0.5);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  z-index: 9999;
}
```

---

## 🔧 Configuración Avanzada

### Interface del Hook Principal
```typescript
interface GenieEffectOptions {
  sourceElement?: HTMLElement;     // Elemento origen (auto-detectado)
  onBeforeTransition?: () => void; // Callback pre-animación
  onAfterTransition?: () => void;  // Callback post-animación
  debug?: boolean;                 // Mostrar punto de origen
}
```

### Detección Automática del Sidebar
El sistema detecta automáticamente:
- Estado del sidebar (`expanded` / `collapsed`)
- Posición exacta del icono clickeado
- Offset dinámico hacia el centro de la ventana

---

## 🎯 Características Técnicas

### Animación de Contracción (Pull Effect)
1. **Inicio lento** (15% del tiempo): Como "agarrando" la ventana
2. **Aceleración gradual** (35-55%): Efecto "pull" con curvatura
3. **Contracción rápida** (75-100%): Hacia el punto de origen

### Animación de Expansión (Release Effect)
1. **Liberación rápida** (0-25%): Expansión inicial acelerada
2. **Crecimiento fluido** (25-70%): Aproximación a forma normal
3. **Bounce suave** (85-100%): Overshoot + estabilización

### Optimizaciones de Performance
- Aceleración hardware completa (`translateZ(0)`)
- Optimización para pantallas retina
- Simplificación automática en móviles
- Respeto a `prefers-reduced-motion`

---

## 🐛 Debug y Troubleshooting

### Activar Debug Mode
```typescript
// En desarrollo
const handleClick = useSidebarGenieNavigation();

// O manualmente
navigateWithGenie('/route', { debug: true });
```

### Console Logs Informativos
```
🎯 Genie Effect - Icon Position: 120, 180 {
  sidebar: 'expanded',
  origin: '8.3%, 15.0%',
  offset: '120px, 180px'
}
```

### Verificación de Elementos
- Asegúrate de que los elementos tengan `data-sidebar-item`
- Verifica que el sidebar tenga `data-sidebar` attribute
- Confirma que la ruta es válida

---

## 📱 Soporte Responsive

### Desktop (≥768px)
- Animaciones completas con perspective 3D
- Todas las optimizaciones habilitadas

### Mobile (<768px)
- Perspective reducida (800px)
- Transforms simplificados
- Hover effects reducidos

---

## 🚀 Performance Tips

1. **Usar el hook simplificado** para casos comunes
2. **Habilitar debug solo en desarrollo**
3. **Evitar animaciones concurrentes**
4. **Respetar los estados del sidebar**

---

## 🔄 Migración desde Versión Anterior

### Antes (Versión Original)
```tsx
import { genieEffectAuthentic } from "./view-transitions";

const handleClick = (e) => {
  e.preventDefault();
  router.push(url, {
    onTransitionReady: () => genieEffectAuthentic(e.currentTarget)
  });
};
```

### Después (Versión Mejorada)
```tsx
import { useSidebarGenieNavigation } from "./useGenieEffect";

const handleClick = useSidebarGenieNavigation();
// ¡Eso es todo! 🎉
```

---

## 📊 Especificaciones Técnicas

| Característica | Valor |
|---|---|
| Duración Contracción | 550ms |
| Duración Expansión | 400ms |
| Cubic Bezier Pull | `(0.25, 0.46, 0.45, 0.94)` |
| Cubic Bezier Release | `(0.165, 0.84, 0.44, 1)` |
| Perspective Dinámica | 1000px → 100px |
| Rotación X | 0° → 20° |
| Escala No Uniforme | Independiente X/Y |
| Estados Soportados | expanded, collapsed |
| Performance Target | 60fps |

---

**¡El efecto genie macOS ya está optimizado y listo para producción! 🚀**
