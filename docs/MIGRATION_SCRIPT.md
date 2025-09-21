# Script de Migración Automática

Este documento describe cómo migrar automáticamente todos los fetch del proyecto al nuevo sistema `useUserFetch`.

## ¿Qué necesita migración?

Todos los componentes que hacen llamadas a APIs internas (`/api/v1/` o `/api/v2/`) deben migrar de `fetch` a `userFetch`.

## Pasos de migración

### 1. Identificar archivos con fetch a APIs internas

```bash
# Buscar todos los archivos que usan fetch con APIs internas
grep -r "fetch.*\/api\/v[12]" src/ --include="*.tsx" --include="*.ts"
```

### 2. Para cada archivo encontrado:

#### Paso A: Añadir import
```tsx
// Añadir al inicio del archivo
import { useUserFetch } from "@/core/hooks/useUserFetch";
```

#### Paso B: Obtener userFetch en el componente
```tsx
function MyComponent() {
  const userFetch = useUserFetch(); // 👈 Añadir esta línea
  
  // ... resto del componente
}
```

#### Paso C: Reemplazar fetch por userFetch
```tsx
// Antes:
const response = await fetch('/api/v2/some-endpoint', { ... });

// Después:
const response = await userFetch('/api/v2/some-endpoint', { ... });
```

## Archivos identificados para migrar

Basado en nuestra búsqueda anterior, estos son los archivos que necesitan migración:

```
c:\Dev\negoco-cloud\negoco-crm\src\dashboard\components\charts\YearlyTramitesBarChart.tsx
c:\Dev\negoco-cloud\negoco-crm\src\core\contexts\UserContext.tsx
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\table\Table.tsx
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\RenewTramiteConfirmationDialog.tsx
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\liquidez\UpdateMultipleTramitesModal.tsx
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\editTramite\UpdateTramiteStatusModal.tsx
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\editTramite\RejectTramiteModal.tsx
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\editTramite\ProviderSection.tsx ✅ (Ya migrado)
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\editTramite\notes\NotesTabContent.tsx
c:\Dev\negoco-cloud\negoco-crm\src\tramites\components\editTramite\notes\DeleteNoteConfirmationModal.tsx
... (y más)
```

## Script de PowerShell para ayuda en la migración

```powershell
# Crear script para encontrar y mostrar todos los archivos que necesitan migración
$files = Get-ChildItem -Path "src/" -Recurse -Include "*.tsx","*.ts" | 
    Select-String -Pattern "fetch.*\/api\/v[12]" | 
    ForEach-Object { $_.Filename } | 
    Sort-Object | 
    Get-Unique

Write-Host "Archivos que necesitan migración:" -ForegroundColor Yellow
$files | ForEach-Object { 
    Write-Host "  - $_" -ForegroundColor Cyan 
}
Write-Host ""
Write-Host "Total de archivos: $($files.Count)" -ForegroundColor Green
```

## Ejemplo de migración completa

### Antes:
```tsx
import { useState } from "react";

function MyComponent() {
  const [data, setData] = useState(null);
  
  const loadData = async () => {
    const response = await fetch('/api/v2/data', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const result = await response.json();
      setData(result);
    }
  };
  
  return <div>...</div>;
}
```

### Después:
```tsx
import { useState } from "react";
import { useUserFetch } from "@/core/hooks/useUserFetch"; // 👈 Nuevo import

function MyComponent() {
  const [data, setData] = useState(null);
  const userFetch = useUserFetch(); // 👈 Nuevo hook
  
  const loadData = async () => {
    const response = await userFetch('/api/v2/data', { // 👈 userFetch en lugar de fetch
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const result = await response.json();
      setData(result);
    }
  };
  
  return <div>...</div>;
}
```

## Verificación

Después de cada migración:

1. **Compilar**: `bun run build`
2. **Probar**: Verificar que la funcionalidad sigue funcionando
3. **Marcar como completo**: ✅ en la lista de archivos

## Beneficios obtenidos

Después de la migración, todos los fetch automaticamente:

- ✅ **Detectarán sesiones expiradas**
- ✅ **Mostrarán el modal de renovación**
- ✅ **Mantendrán el contexto del usuario**
- ✅ **Proporcionarán mejor experiencia de usuario**

## No migrar

**NO migrar** estos casos:
- ❌ Fetch a APIs externas (fuera de `/api/v1/` y `/api/v2/`)
- ❌ Fetch en el lado del servidor (API routes)
- ❌ Fetch en middleware
- ❌ Fetch para recursos estáticos
