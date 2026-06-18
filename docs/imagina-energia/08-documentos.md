# 08 - Documentos

## Endpoint

```http
POST /documento
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Carga documentos asociados a un contrato existente.

## Campos

| Campo | Tipo | Requerido | Regla |
| --- | --- | --- | --- |
| `id_contrato` | string | Si | ID interno de contrato en Imagina Energia |
| `fichero` | binary | Si | Archivo a cargar |
| `tipo_fichero` | string | Si | Tipo de documento |
| `fecha_firma` | date | No | Fecha de firma del documento |
| `fecha_documento` | date | No | Fecha del documento |
| `cups` | string | No | CUPS asociado, si aplica |

Content types permitidos por OpenAPI para `fichero`:

- `application/pdf`
- `image/png`
- `image/jpeg`
- `image/jpg`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

## Tipos de documento

Valores enum del YAML:

- `Acta de Inspección`
- `Acta de Puesta en Marcha`
- `Acuerdo reparto`
- `Alta sum. obras`
- `Alta sum. temporal`
- `Anexo contrato`
- `Anexo modificación administrativa`
- `Anexo modificación precios`
- `Anexo modificación técnica`
- `Baja`
- `Baja voluntaria definitiva`
- `Bono Social`
- `Cambio a TPV`
- `Cambio domiciliación`
- `Cambio potencia`
- `Cambio tarifa`
- `Cambio titularidad`
- `Cancelación contrato`
- `CIE consumo`
- `CIE generación`
- `Contrato`
- `Costes`
- `Desistimiento`
- `Devolución Fianza`
- `Facturas`
- `Fianza`
- `Identificador Cliente`
- `Mandato`
- `Oferta`
- `Otra documentación del cliente`
- `Otros`
- `Reclamación`
- `Respuesta a reclamación`
- `Socio`

La guia de contratacion menciona `DNI` como ejemplo, pero no aparece en el enum OpenAPI. Para identificacion usar `Identificador Cliente` salvo confirmacion contraria.

## Respuesta

```json
{
  "request_id": 12345,
  "result_operation": {
    "id_documento": "doc_abc123",
    "url": "https://storage.example.com/documents/doc_abc123.pdf",
    "status": "uploaded"
  }
}
```

## Momento de subida

La guia recomienda subir documentacion despues de recibir callback de contratacion y confirmar que `contrato_result.result_operation === "OK"`.

Flujo interno:

1. Recibir callback de alta.
2. Validar HMAC.
3. Persistir contrato creado.
4. Resolver documentos obligatorios del tramite local.
5. Encolar subida a `POST /documento`.
6. Persistir resultado por documento y `request_id`.

## Errores

| Codigo | Interpretacion |
| --- | --- |
| `400` | Form-data incompleto, tipo no permitido o validacion fallida |
| `401` | JWT invalido |
| `403` | Contrato no pertenece al canal o impersonacion sin permisos |
| `500` | Error interno |

## Reintentos

- Reintentar solo errores transitorios (`429`, `500`, timeouts).
- No reintentar `400` sin corregir payload.
- Para `403` revisar canal/tenant antes de reintentar.
- Evitar duplicados guardando hash de archivo + `id_contrato` + `tipo_fichero`.
