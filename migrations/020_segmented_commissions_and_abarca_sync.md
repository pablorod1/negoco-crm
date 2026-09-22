# Migración 020: comisiones segmentadas y sincronización Abarca

Esta migración requiere una ventana coordinada: pausar escritores, hacer copia
de seguridad de cada tenant, ejecutar el SQL y desplegar el código nuevo antes
de reabrir las escrituras. No se debe volver a una versión que escriba reglas
sin `segment`.

Variables de servidor necesarias:

- `ABARCA_COMISION_API_KEY`: clave enviada en `X-API-KEY`.
- `ABARCA_COMISION_API_URL`: URL base exacta y confirmada del endpoint por
  usuario; el cliente añade `/<user.abarca_user_id>`.
- `ABARCA_COMISION_TENANTS`: slugs de tenants separados por comas usados
  únicamente por el simulador de solo lectura.

No se incluye una URL inferida de Abarca: su documentación pública no expone el
contrato de comisiones. La URL debe copiarse del contrato privado ya probado.

Antes de permitir sincronizaciones manuales:

1. Ejecutar `pnpm simulate:abarca-commissions`; solo hace GET y muestra reglas,
   retiradas y mapeos pendientes.
2. Revisar colisiones de `abarca_user_id` entre tenants.
3. Configurar los nombres exactos desde Colaboradores → Abarca.
4. Probar un usuario individual conocido y confirmar mediante GET los valores,
   las retiradas a cero y `comision_personalizada: null`.

No hay sincronización programada. Guardar reglas o mapeos solo actualiza el CRM
y deja el estado pendiente. El envío a Abarca se ejecuta exclusivamente cuando
un administrador pulsa `Sincronizar` para un colaborador.

La migración replica cada regla antigua en `luz_20td`, `luz_pymes` y `gas`,
incluidos los ceros explícitos. Solo rellena automáticamente las comparativas
históricas de Gas; las tarifas de luz desconocidas permanecen sin segmento.
