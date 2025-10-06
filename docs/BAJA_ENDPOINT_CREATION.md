# Creación de Endpoint Específico para Bajas

## Problema Identificado

Al intentar crear una baja desde el formulario `CreateBajaForm`, se producía un error de validación `Invalid data format` porque el endpoint `/api/v2/contracts` (POST) requiere un objeto `Client` completo con todos los campos obligatorios:

- `email` (formato email válido)
- `type` (tipo de cliente)
- `phone` (teléfono)
- `address` (dirección)
- `IBAN` (cuenta bancaria)
- `postal_code`, `province`, `city`

Sin embargo, el formulario de bajas solo solicita:
- `name` (nombre del cliente)
- `document_number` (DNI)
- `CUPS` (identificador del punto de suministro)
- `liquidez_status` (estado de liquidez)
- `comision` y `comision_sales_person` (comisiones)

## Solución Implementada

Se ha creado un nuevo endpoint específico para bajas que solo requiere los campos mínimos necesarios:

### Nuevo Endpoint: `/api/v2/contracts/bajas`

**Ubicación:** `src/app/api/v2/contracts/bajas/route.ts`

#### Características

1. **Schemas Simplificados:**
   - `BajaClientSchema`: Solo requiere `id`, `name`, `document_number`, `document_type`
   - `BajaTramiteSchema`: Campos específicos de bajas con `status: "Baja"` obligatorio
   - `BajaContractSchema`: CUPS obligatorio, otros campos con valores por defecto

2. **Valores por Defecto:**
   El endpoint automáticamente asigna valores por defecto para campos no proporcionados:
   ```typescript
   email: "baja@negoco.com"
   phone: "000000000"
   address: "Sin dirección"
   type: "Particular"
   IBAN: "ES0000000000000000000000"
   ```

3. **Validación Específica:**
   - Estado debe ser exactamente `"Baja"`
   - `liquidez_status` debe ser uno de los valores permitidos
   - Las comisiones se manejan correctamente (valores negativos)

4. **Transacciones:**
   - Utiliza transacciones de base de datos para garantizar consistencia
   - Rollback automático en caso de error
   - Métricas de rendimiento incluidas

## Cambios en el Componente

**Archivo:** `src/tramites/components/createBaja/CreateBajaForm.tsx`

- Se actualizó el endpoint de destino de `/api/v2/contracts` a `/api/v2/contracts/bajas`
- Se eliminaron los valores por defecto del estado inicial (ya no son necesarios)

## Ventajas de esta Solución

1. **Separación de Responsabilidades:** Endpoint específico para bajas, no sobrecarga el endpoint general
2. **Validación Específica:** Solo valida lo que realmente se necesita para una baja
3. **Mantenibilidad:** Más fácil de mantener y evolucionar independientemente
4. **Rendimiento:** Esquemas más simples = validación más rápida
5. **Seguridad:** Valores por defecto controlados del lado del servidor

## Testing

Para probar el nuevo endpoint:

1. Navegar al formulario de creación de bajas
2. Completar los campos:
   - Estado de Liquidez
   - Nombre del Cliente
   - DNI
   - CUPS
   - Comisión
   - Comisión comercial
3. Enviar el formulario

El endpoint debe crear:
- Un registro de cliente (si no existe)
- Un registro de trámite con estado "Baja"
- Un registro de contrato con el CUPS especificado

## Notas Técnicas

- El endpoint utiliza `Pick<Client, "execute">` para el tipo `DBExecutor`, asegurando compatibilidad con transacciones
- Se incluyen logs detallados con el prefijo `[BAJA]` para facilitar el debugging
- Las comisiones se convierten automáticamente a valores negativos en el componente antes de enviar

## Migración

No se requiere migración de datos. El endpoint es retrocompatible y utiliza las mismas tablas de base de datos que el endpoint general.

## Fecha de Creación

Octubre 6, 2025
