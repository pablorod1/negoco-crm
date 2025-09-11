# Sistema de Renovación de Sesión

Este sistema permite al usuario renovar su sesión cuando expira sin tener que recargar la página o perder el contexto actual.

## Funcionamiento

Cuando una sesión expira (después de 24h de inactividad), el usuario verá un modal que le permite:

1. **Renovar la sesión**: Introducir su contraseña para renovar la sesión y continuar trabajando
2. **Cancelar**: Cerrar el modal y continuar sin funcionalidad de API (no recomendado)

## Componentes principales

### `SessionExpiredModal`
- Modal que se muestra cuando la sesión expira
- Incluye un formulario para introducir la contraseña
- Muestra el email del usuario (solo lectura)
- Maneja la renovación de sesión automáticamente

### `useSessionExpiration`
- Hook que maneja el estado del modal de sesión expirada
- Detecta respuestas HTTP 401 y determina si son por sesión expirada
- Evita mostrar múltiples modales simultáneamente

### `useAuthenticatedFetch`
- Hook que proporciona una función fetch que automáticamente verifica sesión expirada
- Wrapper sobre fetch nativo que integra la verificación de sesión

## Uso en componentes

### Opción 1: Usar useAuthenticatedFetch (Recomendado)

```tsx
import { useAuthenticatedFetch } from "@/core/hooks/useAuthenticatedFetch";

function MyComponent() {
  const authenticatedFetch = useAuthenticatedFetch();

  const handleSubmit = async () => {
    try {
      const response = await authenticatedFetch("/api/v2/some-endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        const result = await response.json();
        // Manejar respuesta exitosa
      }
    } catch (error) {
      // Manejar errores
    }
  };
}
```

### Opción 2: Verificación manual

```tsx
import { useUser } from "@/core/contexts/UserContext";

function MyComponent() {
  const { checkForSessionExpiration } = useUser();

  const handleSubmit = async () => {
    try {
      const response = await fetch("/api/v2/some-endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      // Verificar manualmente si la sesión expiró
      if (checkForSessionExpiration(response)) {
        return; // El modal se mostrará automáticamente
      }
      
      if (response.ok) {
        const result = await response.json();
        // Manejar respuesta exitosa
      }
    } catch (error) {
      // Manejar errores
    }
  };
}
```

## Características técnicas

### Detección de sesión expirada
- Se activa con respuestas HTTP 401
- Verifica el contenido del error para confirmar que es por sesión expirada
- Evita falsos positivos con otros tipos de errores 401

### Renovación de sesión
- Usa Better Auth para reautenticar al usuario
- Mantiene el contexto actual de la página
- Muestra toast de confirmación cuando la sesión se renueva exitosamente
- No requiere redirección ni recarga de página

### Prevención de duplicados
- Solo muestra un modal a la vez
- Ignora nuevas detecciones mientras el modal está abierto
- Manejo de estado optimizado para evitar renders innecesarios

## Beneficios

1. **Mejor UX**: El usuario no pierde su trabajo o contexto
2. **Menos interrupciones**: No hay redirecciones forzadas
3. **Continuidad**: Mantiene el estado de formularios y modales abiertos
4. **Feedback claro**: El usuario sabe exactamente qué está pasando

## Migración

Para migrar componentes existentes:

1. Reemplaza `fetch` por `useAuthenticatedFetch()`
2. O añade `checkForSessionExpiration(response)` después de llamadas fetch existentes
3. El modal se manejará automáticamente desde el UserContext

No se requieren cambios adicionales en la mayoría de los casos.
