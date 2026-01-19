# Plan de Implementación: Corrección del Filtrado por Rol en Energy Suppliers

## 📋 Resumen Ejecutivo

**Fecha de Análisis:** 19 de enero de 2026  
**Severidad:** 🔴 CRÍTICA  
**Estado:** Pendiente de implementación  
**Endpoints Afectados:**
- `/api/v2/energy-suppliers` (listado principal)
- `/api/v2/energy-suppliers/by-name/[name]` (detalle por nombre)

---

## 🔍 Análisis del Problema

### Síntoma Reportado
Un usuario con `role = 2` que tiene **solo 1 trámite asociado** visualiza el **total de trámites de todos los usuarios** en lugar de solo los suyos y los de sus subcomerciales.

### Flujo de Datos Actual

```
┌─────────────────────────────┐
│ ComercializadorasList.tsx   │
│ (Componente React)          │
└─────────────┬───────────────┘
              │ useComercializadoras()
              ▼
┌─────────────────────────────┐
│ useComercializadoras.ts     │
│ Hook que envía:             │
│ - user_id: userData.id      │
│ - user_role: userData.role  │
└─────────────┬───────────────┘
              │ POST /api/v2/energy-suppliers
              ▼
┌─────────────────────────────┐
│ route.ts (API Endpoint)     │
│ ❌ Filtrado SQL incorrecto  │
└─────────────────────────────┘
```

---

## 🐛 Bugs Identificados

### Bug #1: Precedencia de Operadores SQL Incorrecta (CRÍTICO)

**Ubicación:** [route.ts#L111-L130](src/app/api/v2/energy-suppliers/route.ts#L111-L130)

**Código Actual:**
```sql
WHERE 
  con.new_company = c.id OR con.new_company = c.name 
  ${userFilterClause}  -- AND (t.user_id = ? OR ...)
```

**Problema:** La cláusula `OR` entre `con.new_company = c.id` y `con.new_company = c.name` tiene **menor precedencia** que `AND`, causando que la evaluación sea:

```sql
-- Se interpreta como:
WHERE con.new_company = c.id 
   OR (con.new_company = c.name AND (t.user_id = ? OR ...))
```

**Esto significa:** Si `con.new_company = c.id`, el filtro de usuario **nunca se aplica**.

### Bug #2: Lógica de Filtrado para Roles != 2 Siempre Verdadera

**Ubicación:** [route.ts#L100-L103](src/app/api/v2/energy-suppliers/route.ts#L100-L103)

**Código Actual:**
```typescript
// Para otros roles:
userFilterClause = `AND (t.user_id = ? OR (t.user_id != ?))`;
userFilterParams.push(user_id, user_id);
```

**Problema:** La condición `(t.user_id = X OR t.user_id != X)` es **siempre verdadera** para cualquier valor de `t.user_id`. Esto es equivalente a no tener filtro.

**Análisis lógico:**
- Si `t.user_id = 'abc'` → `('abc' = ? OR 'abc' != ?)` → `TRUE OR FALSE` → `TRUE`
- Si `t.user_id = 'xyz'` → `('xyz' = ? OR 'xyz' != ?)` → `FALSE OR TRUE` → `TRUE`

### Bug #3: El mismo patrón se repite en la subquery de `total_consumption`

**Ubicación:** [route.ts#L128-L135](src/app/api/v2/energy-suppliers/route.ts#L128-L135)

Los mismos problemas de precedencia de operadores afectan la segunda subquery.

---

## ✅ Solución Propuesta

### Fix #1: Corregir Precedencia con Paréntesis Explícitos

**Query Corregida:**
```sql
(
  SELECT COUNT(DISTINCT con.tramite_id)
  FROM contracts con
  JOIN tramites t ON t.id = con.tramite_id
  WHERE (con.new_company = c.id OR con.new_company = c.name)
    ${userFilterClause}
) as total_tramites
```

### Fix #2: Corregir Lógica para Roles No-Comerciales

**Opción A - Sin filtro (mostrar todo):**
```typescript
if (user_role === "2") {
  // ... lógica existente para rol 2
} else {
  // Para otros roles (admin, supervisor general, etc.): sin filtro de usuario
  userFilterClause = "";  // No agregar filtro
  // userFilterParams permanece vacío
}
```

**Opción B - Mantener consistencia semántica (filtro que no restringe):**
```typescript
} else {
  // Para otros roles: mostrar todos los trámites (1=1 es siempre true pero es explícito)
  userFilterClause = ""; // No se necesita filtro adicional
}
```

### Fix #3: Aplicar Mismo Patrón a Subquery de `total_consumption`

---

## 📝 Cambios de Código Requeridos

### Archivo: `src/app/api/v2/energy-suppliers/route.ts`

#### Cambio 1: Corregir lógica de filtrado para roles != 2 (líneas ~100-103)

**Antes:**
```typescript
} else {
  // For other roles: show all non-draft tramites or user's own tramites (including drafts)
  userFilterClause = `AND (t.user_id = ? OR (t.user_id != ?))`;
  userFilterParams.push(user_id, user_id);
}
```

**Después:**
```typescript
} else {
  // For other roles (admin, supervisor, etc.): no user filtering, show all tramites
  userFilterClause = "";
  // userFilterParams stays empty - no parameters needed
}
```

#### Cambio 2: Agregar paréntesis en subquery de total_tramites (líneas ~117-124)

**Antes:**
```sql
WHERE 
  con.new_company = c.id OR con.new_company = c.name 
  ${userFilterClause}
```

**Después:**
```sql
WHERE (con.new_company = c.id OR con.new_company = c.name)
  ${userFilterClause}
```

#### Cambio 3: Agregar paréntesis en subquery de total_consumption (líneas ~128-134)

**Antes:**
```sql
WHERE t.status = 'Activo' AND (
  con.new_company = c.id OR con.new_company = c.name
) ${userFilterClause}
```

**Después:**
```sql
WHERE t.status = 'Activo' 
  AND (con.new_company = c.id OR con.new_company = c.name)
  ${userFilterClause}
```

### Archivo: `src/app/api/v2/energy-suppliers/by-name/[name]/route.ts`

Aplicar los mismos cambios ya que contiene el mismo patrón de errores.

---

## 🧪 Plan de Testing

### Test Case 1: Usuario con Rol 2 y 1 Trámite
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Login como usuario rol=2 con 1 trámite | - |
| 2 | Navegar a lista de comercializadoras | Ver `num_tramites = 1` en la comercializadora correspondiente |
| 3 | Verificar otras comercializadoras | Ver `num_tramites = 0` donde no tiene trámites |

### Test Case 2: Usuario con Rol 2 y Subcomerciales
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Login como supervisor (rol=2) con 2 subcomerciales | - |
| 2 | Subcomercial A tiene 3 trámites | - |
| 3 | Subcomercial B tiene 2 trámites | - |
| 4 | Supervisor tiene 1 trámite propio | - |
| 5 | Ver lista de comercializadoras | `num_tramites = 6` (total de supervisor + subcomerciales) |

### Test Case 3: Usuario Admin (Rol != 2)
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Login como admin | - |
| 2 | Ver lista de comercializadoras | Ver total real de trámites sin filtrar |

### Test Case 4: Validación SQL Manual
```sql
-- Ejecutar directamente en base de datos para validar
SELECT 
  c.name,
  (
    SELECT COUNT(DISTINCT con.tramite_id)
    FROM contracts con
    JOIN tramites t ON t.id = con.tramite_id
    WHERE (con.new_company = c.id OR con.new_company = c.name)
      AND t.user_id = 'ID_USUARIO_TEST'
  ) as num_tramites_filtrado,
  (
    SELECT COUNT(DISTINCT con.tramite_id)
    FROM contracts con
    WHERE con.new_company = c.id OR con.new_company = c.name
  ) as num_tramites_total
FROM comercializadoras c
WHERE c.name = 'NOMBRE_COMERCIALIZADORA_TEST';
```

---

## 📊 Diagrama de Query Corregida

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUERY STRUCTURE (FIXED)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SELECT c.id, c.name, c.logo, c.active,                        │
│                                                                 │
│  ┌─────────────────── SUBQUERY 1 ───────────────────┐          │
│  │ SELECT COUNT(DISTINCT con.tramite_id)            │          │
│  │ FROM contracts con                               │          │
│  │ JOIN tramites t ON t.id = con.tramite_id         │          │
│  │ WHERE                                            │          │
│  │   ┌──────────────────────────────────────┐       │          │
│  │   │ (con.new_company = c.id              │       │          │
│  │   │  OR con.new_company = c.name)        │ ← FIX │          │
│  │   └──────────────────────────────────────┘       │          │
│  │   AND (t.user_id = ? OR t.user_id IN (?,...))   │ ← FIX    │
│  └──────────────────────────────────────────────────┘          │
│  as total_tramites,                                             │
│                                                                 │
│  ┌─────────────────── SUBQUERY 2 ───────────────────┐          │
│  │ SELECT SUM(con.consumption)                      │          │
│  │ FROM contracts con                               │          │
│  │ INNER JOIN tramites t ON con.tramite_id = t.id   │          │
│  │ WHERE t.status = 'Activo'                        │          │
│  │   AND (con.new_company = c.id                    │          │
│  │        OR con.new_company = c.name)              │ ← FIX    │
│  │   AND (t.user_id = ? OR t.user_id IN (?,...))   │ ← FIX    │
│  └──────────────────────────────────────────────────┘          │
│  as total_consumption                                           │
│                                                                 │
│  FROM comercializadoras c                                       │
│  ORDER BY c.name ASC                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Pasos de Implementación

### Fase 1: Preparación
- [ ] Backup de endpoints actuales
- [ ] Documentar valores actuales para comparación post-fix

### Fase 2: Implementación
- [ ] Modificar `route.ts` del endpoint principal
- [ ] Modificar `route.ts` del endpoint by-name
- [ ] Agregar logs de debugging temporales

### Fase 3: Validación
- [ ] Ejecutar test cases manuales
- [ ] Comparar resultados antes/después
- [ ] Verificar que roles admin siguen viendo todo

### Fase 4: Cleanup
- [ ] Remover logs de debugging
- [ ] Actualizar documentación si es necesario

---

## ⚠️ Consideraciones de Impacto

1. **Usuarios con Rol 2:** Verán menos trámites (solo los suyos + subcomerciales) - Esto es el **comportamiento correcto**
2. **Usuarios Admin:** Sin cambios en comportamiento
3. **Performance:** Sin impacto significativo (misma cantidad de queries)
4. **Breaking Changes:** Ninguno en la API, solo corrección de lógica

---

## 📎 Archivos Relacionados

- [src/app/api/v2/energy-suppliers/route.ts](src/app/api/v2/energy-suppliers/route.ts)
- [src/app/api/v2/energy-suppliers/by-name/[name]/route.ts](src/app/api/v2/energy-suppliers/by-name/%5Bname%5D/route.ts)
- [src/comercializadoras/hooks/useComercializadoras.ts](src/comercializadoras/hooks/useComercializadoras.ts)
- [src/comercializadoras/components/ComercializadorasList.tsx](src/comercializadoras/components/ComercializadorasList.tsx)
- [src/core/libsql/users/getSubcomerciales.ts](src/core/libsql/users/getSubcomerciales.ts)
