# Corrección del Error de Validación "Expected array, received string"

## Problema Identificado

Al intentar actualizar la información de un cliente usando la opción "Actualizar Existente", se producía el siguiente error:

```
Error al guardar los cambios
Validation error: Expected array, received string
PATCH /api/v2/contracts/[id]/client 400 in 204ms
```

## Análisis del Problema

### Causa Raíz
El error se producía en el esquema de validación Zod del endpoint `/api/v2/contracts/[id]/client`. Específicamente en el campo `coordinates`:

**Esquema original (problemático):**
```typescript
coordinates: z.tuple([z.number(), z.number()]).nullable().optional(),
```

**Problema:** 
- En la base de datos, las coordenadas se almacenan como `TEXT` (JSON stringificado)
- Al recuperar datos de la base de datos, las coordenadas vienen como string: `"[lat, lng]"`
- El esquema esperaba directamente un array `[number, number]`
- Esto causaba que la validación fallara con "Expected array, received string"

### Flujo del Problema

1. **Almacenamiento en DB**: Las coordenadas se guardan como JSON string
   ```typescript
   coordinates ? JSON.stringify(coordinates) : null
   ```

2. **Recuperación de DB**: Las coordenadas vienen como string `"[40.4168, -3.7038]"`

3. **Validación Zod**: Esperaba array `[40.4168, -3.7038]` pero recibía string

4. **Error**: "Expected array, received string"

## Solución Implementada

### Nuevo Esquema de Validación

```typescript
coordinates: z.union([
  z.tuple([z.number(), z.number()]),
  z.string(),
  z.null(),
  z.undefined()
]).optional().transform((val): [number, number] | null => {
  if (typeof val === 'string' && val) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) && parsed.length === 2 && 
             typeof parsed[0] === 'number' && typeof parsed[1] === 'number' 
             ? [parsed[0], parsed[1]] : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(val) && val.length === 2 && 
         typeof val[0] === 'number' && typeof val[1] === 'number' 
         ? [val[0], val[1]] : null;
})
```

### Características de la Solución

1. **Flexibilidad de Tipos**: Acepta multiple tipos de entrada:
   - `[number, number]` - Array directo
   - `string` - JSON stringificado
   - `null` - Valor nulo
   - `undefined` - Valor indefinido

2. **Transformación Segura**: 
   - Parsea strings JSON de manera segura con try/catch
   - Valida que el resultado parseado sea un array válido
   - Verifica que contenga exactamente 2 números
   - Retorna `null` para valores inválidos

3. **Compatibilidad**: 
   - Mantiene compatibilidad con datos existentes en DB
   - Funciona con nuevos datos enviados como array
   - Maneja casos edge como strings vacíos o malformados

## Archivo Modificado

- **Archivo**: `src/app/api/v2/contracts/[id]/client/route.ts`
- **Líneas**: Schema `ClientSchema` - campo `coordinates`
- **Tipo de cambio**: Actualización del esquema de validación Zod

## Validación de la Solución

### Casos de Prueba Cubiertos

1. ✅ **Coordenadas como string JSON**: `"[40.4168, -3.7038]"`
2. ✅ **Coordenadas como array**: `[40.4168, -3.7038]`
3. ✅ **Coordenadas nulas**: `null`
4. ✅ **Coordenadas indefinidas**: `undefined`
5. ✅ **Strings malformados**: `"invalid"` → `null`
6. ✅ **Arrays inválidos**: `[1]` → `null`
7. ✅ **Strings vacíos**: `""` → `null`

### Comportamiento Esperado

- **Antes**: Error 400 - "Expected array, received string"
- **Después**: Validación exitosa y actualización correcta del cliente

## Impacto

### Beneficios
- ✅ Elimina error de validación en actualización de clientes
- ✅ Mantiene compatibilidad con datos existentes
- ✅ Permite múltiples formatos de entrada para coordenadas
- ✅ Manejo robusto de casos edge

### Sin Riesgos
- ✅ No rompe funcionalidad existente
- ✅ Mantiene tipos de salida consistentes
- ✅ Preserva integridad de datos
- ✅ Compatible con versiones anteriores

## Monitoring y Seguimiento

### Métricas a Observar
1. Reducción en errores 400 en endpoint `/api/v2/contracts/[id]/client`
2. Aumento en actualizaciones exitosas de clientes
3. Sin regresiones en funcionalidad de coordenadas

### Logs Relevantes
- Monitorear logs de validación Zod
- Verificar que actualizaciones de cliente se completen sin errores
- Confirmar que coordenadas se almacenan correctamente

## Notas Técnicas

### Consideraciones de Performance
- La transformación de coordenadas es mínima (solo parsing JSON)
- No impacta significativamente en tiempo de respuesta
- Validación adicional es necesaria pero eficiente

### Mantenimiento Futuro
- Considerar estandarizar formato de coordenadas en toda la aplicación
- Evaluar migración a formato consistente en DB si es necesario
- Documentar formato esperado para coordenadas en API documentation
