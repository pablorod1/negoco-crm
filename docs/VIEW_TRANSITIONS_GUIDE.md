# Guía de Transiciones de Vista (View Transitions)

Este documento explica las diferentes animaciones de transición disponibles en el CRM y cómo usarlas.

## Animaciones Disponibles

### 1. `slideOut()` / `slideIn()`
**Descripción**: Transiciones laterales simples hacia la izquierda/derecha.
**Uso**: Para navegación estándar entre páginas.
**Duración**: 400ms

### 2. `slideInOut()`
**Descripción**: Transición vertical con efecto de clip-path que se despliega de abajo hacia arriba.
**Uso**: Para transiciones más dramáticas.
**Duración**: 1500ms

### 3. `genieEffect(sourceElement)` ✨ **MEJORADO**
**Descripción**: Efecto genie de macOS con deformación y curvatura avanzada.
**Uso**: Para navegación desde elementos específicos del sidebar.
**Características**:
- Múltiples keyframes con deformación progresiva
- Usa `clip-path` con polígonos complejos para simular curvatura
- Combina `scale`, `translate` y `rotateX/Y` para efecto 3D
- Duración: 700ms salida, 900ms entrada

### 4. `genieEffectPremium(sourceElement)` ✨ **NUEVO**
**Descripción**: Versión premium del efecto genie con perspectiva 3D completa.
**Uso**: Máxima fidelidad al efecto de macOS.
**Características**:
- Perspectiva 3D avanzada con `perspective(1000px)`
- Rotaciones X/Y para simular profundidad
- Deformación extrema con clip-path complejo
- Bounce suave al final
- Duración: 800ms salida, 1100ms entrada

### 5. `genieEffectAuthentic(sourceElement)` ✨ **NUEVO**
**Descripción**: Efecto genie auténtico basado en el CodePen de referencia.
**Uso**: Simulación fiel del efecto embudo/genie de macOS.
**Características**:
- Curvatura tipo embudo progresiva
- Transform-origin dinámico basado en posición del icono
- Deformación suave pero visible
- Bounce natural al expandir
- Duración: 750ms salida, 950ms entrada

### 6. `genieEffectSubtle(sourceElement)`
**Descripción**: Versión más sutil del efecto genie, solo con escalado suave.
**Uso**: Para una experiencia más discreta.
**Duración**: 300ms salida, 400ms entrada

## Implementación en el Sidebar

### Configuración Actual
En `Sidebar.tsx`, los enlaces del sidebar usan el `genieEffectPremium` por defecto:

```tsx
const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  
  // Capturar el elemento clickeado para la animación
  const clickedElement = e.currentTarget;
  
  router.push(item.url, {
    onTransitionReady: () => genieEffectPremium(clickedElement),
  });
};
```

### Atributos Importantes
Cada enlace del sidebar tiene el atributo `data-sidebar-item` para facilitar la identificación:

```tsx
<a
  href={isDisabled ? "#" : item.url}
  className="..."
  onClick={handleClick}
  data-sidebar-item={item.url}
>
```

## Cambiar entre Animaciones

Para cambiar la animación utilizada, simplemente reemplaza la función en `onTransitionReady`:

```tsx
// Efecto genie premium (actual) - Máxima fidelidad
onTransitionReady: () => genieEffectPremium(clickedElement)

// Efecto genie auténtico - Basado en CodePen de referencia
onTransitionReady: () => genieEffectAuthentic(clickedElement)

// Efecto genie original - Versión mejorada
onTransitionReady: () => genieEffect(clickedElement)

// Efecto genie sutil - Más discreto
onTransitionReady: () => genieEffectSubtle(clickedElement)

// Efecto deslizamiento vertical - Original
onTransitionReady: slideInOut

// Sin animación específica (usa CSS por defecto)
onTransitionReady: simpleSlide
```

### Recomendaciones de Uso

- **`genieEffectPremium`**: Para la experiencia más impresionante y fiel a macOS
- **`genieEffectAuthentic`**: Para un balance entre autenticidad y rendimiento
- **`genieEffect`**: Para una versión mejorada pero menos intensiva
- **`genieEffectSubtle`**: Para aplicaciones empresariales que prefieren efectos discretos

## Personalización

### Modificar Duraciones
Las duraciones se pueden ajustar en cada función de `view-transitions.ts`.

### Cambiar Easing
Los valores de easing están optimizados para cada efecto:
- `cubic-bezier(0.25, 0.46, 0.45, 0.94)`: Suave y natural (genie)
- `cubic-bezier(0.34, 1.56, 0.64, 1)`: Con bounce al final (genie sutil)

### CSS Personalizado
Los estilos adicionales están en `globals.css` bajo el comentario "Animaciones para el efecto genie".

## Notas Técnicas

- El efecto genie requiere que el elemento fuente esté visible en el momento del click
- Las transiciones solo funcionan en navegadores con soporte para View Transition API
- Next.js debe tener el flag `viewTransition` habilitado en la configuración
- El elemento `main-content` debe tener la clase CSS correspondiente para las animaciones

## Futuras Mejoras

- [ ] Agregar más variaciones del efecto genie
- [ ] Implementar animaciones específicas por tipo de contenido
- [ ] Añadir prefetching inteligente basado en hover
- [ ] Optimizar rendimiento en dispositivos móviles
