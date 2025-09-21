# Ejemplo de Migración: ProviderSection

Este es un ejemplo de cómo migrar un componente existente para usar el nuevo sistema de renovación de sesión.

## Antes (Código original)

```tsx
// src/tramites/components/editTramite/ProviderSection.tsx

export default function ProviderSection({ tramite, onUpdate }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const updateProvider = async (newProvider: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/v2/contracts/${tramite.id}/provider`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: newProvider,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onUpdate();
        showCustomToast({
          title: "Proveedor actualizado",
          message: "El proveedor se ha actualizado correctamente.",
          icon: CheckCircle,
          iconSize: 24,
          iconColor: "var(--success-color)",
        });
      } else {
        throw new Error("Error al actualizar proveedor");
      }
    } catch (error) {
      console.error("Error:", error);
      showCustomToast({
        title: "Error",
        message: "No se pudo actualizar el proveedor.",
        icon: AlertCircle,
        iconSize: 24,
        iconColor: "var(--error-color)",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ... resto del componente
}
```

## Después (Con renovación de sesión)

### Opción 1: Usando useAuthenticatedFetch (Recomendado)

```tsx
// src/tramites/components/editTramite/ProviderSection.tsx

import { useAuthenticatedFetch } from "@/core/hooks/useAuthenticatedFetch";

export default function ProviderSection({ tramite, onUpdate }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const authenticatedFetch = useAuthenticatedFetch(); // 👈 Nuevo hook

  const updateProvider = async (newProvider: string) => {
    setIsLoading(true);

    try {
      // 👇 Usar authenticatedFetch en lugar de fetch
      const response = await authenticatedFetch(`/api/v2/contracts/${tramite.id}/provider`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: newProvider,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onUpdate();
        showCustomToast({
          title: "Proveedor actualizado",
          message: "El proveedor se ha actualizado correctamente.",
          icon: CheckCircle,
          iconSize: 24,
          iconColor: "var(--success-color)",
        });
      } else {
        throw new Error("Error al actualizar proveedor");
      }
    } catch (error) {
      console.error("Error:", error);
      showCustomToast({
        title: "Error",
        message: "No se pudo actualizar el proveedor.",
        icon: AlertCircle,
        iconSize: 24,
        iconColor: "var(--error-color)",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ... resto del componente
}
```

### Opción 2: Verificación manual

```tsx
// src/tramites/components/editTramite/ProviderSection.tsx

import { useUser } from "@/core/contexts/UserContext";

export default function ProviderSection({ tramite, onUpdate }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { checkForSessionExpiration } = useUser(); // 👈 Nuevo hook

  const updateProvider = async (newProvider: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/v2/contracts/${tramite.id}/provider`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: newProvider,
        }),
      });

      // 👇 Verificar si la sesión expiró antes de continuar
      if (checkForSessionExpiration(response)) {
        setIsLoading(false);
        return; // El modal se mostrará automáticamente
      }

      if (response.ok) {
        const result = await response.json();
        onUpdate();
        showCustomToast({
          title: "Proveedor actualizado",
          message: "El proveedor se ha actualizado correctamente.",
          icon: CheckCircle,
          iconSize: 24,
          iconColor: "var(--success-color)",
        });
      } else {
        throw new Error("Error al actualizar proveedor");
      }
    } catch (error) {
      console.error("Error:", error);
      showCustomToast({
        title: "Error",
        message: "No se pudo actualizar el proveedor.",
        icon: AlertCircle,
        iconSize: 24,
        iconColor: "var(--error-color)",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ... resto del componente
}
```

## Cambios requeridos

### Para la Opción 1 (useAuthenticatedFetch):
1. Importar `useAuthenticatedFetch`
2. Obtener la función `authenticatedFetch` del hook
3. Reemplazar `fetch` por `authenticatedFetch`

### Para la Opción 2 (Verificación manual):
1. Importar `useUser` 
2. Obtener `checkForSessionExpiration` del contexto
3. Añadir verificación después de cada fetch
4. Retornar early si la sesión expiró

## Beneficios de la migración

- ✅ **Detección automática**: Se detecta cuando la sesión expira
- ✅ **Modal informativo**: El usuario sabe qué está pasando
- ✅ **Renovación sin redirección**: Mantiene el contexto actual
- ✅ **Experiencia fluida**: No se pierde el progreso del usuario
- ✅ **Feedback claro**: Toast de confirmación cuando se renueva la sesión

## Consideraciones

- La **Opción 1** es más limpia y fácil de mantener
- La **Opción 2** ofrece más control granular pero requiere más código
- Ambas opciones son compatibles y pueden coexistir
- No se requieren cambios en la lógica de negocio existente
