# 03 - Alta de Contratos

## Endpoints

| Endpoint | Uso |
| --- | --- |
| `POST /contrato/residencial` | Alta universal para persona fisica. Soporta C1, C2 y A3 |
| `POST /contrato/empresa` | Alta universal para persona juridica. Soporta C1, C2 y A3 |
| `POST /contrato/residencial/c1` | Legacy C1 residencial |
| `POST /contrato/empresa/c1` | Legacy C1 empresa |

Decision interna: implementar primero los endpoints universales. Mantener los `/c1` como fallback si Imagina Energia nos lo pide para un canal concreto.

## Flujo asincrono

La guia de contratacion define el alta como proceso asincrono. En Negoco CRM no se debe disparar cuando se crea el tramite/contrato local. El disparador funcional sera el cambio de estado a `Verificado` desde `src/tramites/components/editTramite/UpdateTramiteStatusModal.tsx`.

Condiciones para permitir el envio:

- El estado seleccionado en el modal es `Verificado`.
- El contrato local asociado al tramite tiene `new_company` que resuelve contra la tabla tenant `comercializadoras`.
- La comercializadora resuelta tiene `name` normalizado igual a `Imagina Energía`.
- El tenant tiene configurada y habilitada la integracion `imagina_energia` en la tabla `integrations`, con `config.x_canal_id`.
- El usuario activa explicitamente el switch de envio a Imagina en el modal.

No se debe comparar por `comercializadoras.id`, porque cada tenant puede tener IDs distintos (`COM-001`, `COM-002`, etc.). La comparacion de elegibilidad debe hacerse por `comercializadoras.name`, usando los datos que ya resuelven `useActiveEnergySuppliers` y `useEnergySupplierById`.

La comprobacion de configuracion tenant no necesita recibir el tramite. Debe ser un endpoint simple de estado de integracion que lea `integrations` y devuelva si Imagina esta habilitado/configurado sin exponer el `x_canal_id`.

Una vez activado el envio:

1. Enviamos payload de contrato con `callback_url`.
2. La API valida esquema y reglas basicas.
3. Responde `202 Accepted` con `request_id`.
4. En background ejecuta credit check, alta en sistema Neuro y envio automatico a firma.
5. Envia callback a `callback_url`.
6. Validamos firma HMAC del callback.
7. Persistimos resultado y subimos documentos con `POST /documento`.

En PRE, la fase de firma puede devolver error porque el servicio de firma no siempre esta activo. La guia indica que esto es esperado en preproduccion.

## Campos comunes obligatorios

Punto de suministro:

- `cups`: se recorta a 20 caracteres si excede.
- `provincia`, `municipio`, `cod_postal`.
- `calle`, `numero_finca`, `tipo_via_cnmc`.
- `potencia_contratada`: array de 6 numeros, P1..P6, en W.
- `id_tarifa`: `id_tarifa_precios` devuelto por `GET /tarifas`, persistido localmente como tarifa externa de Imagina.
- `iban`.

Direccion del titular:

- `provincia_titular`, `municipio_titular`, `cod_postal_titular`.
- `calle_titular`, `numero_finca_titular`, `tipo_via_titular_cnmc`.

Firma:

- `canal_envio`: `sms`, `email` o `email_otp`.
- Si no se informa `telefono_firmante` o `email_firmante`, se usan los datos del titular.
- En el flujo operativo por defecto no se enviara `no_enviar_firma: true`; usamos el flujo automatico de firma de Imagina.

Trazabilidad:

- `callback_url`: en la guia es obligatorio para flujo asincrono.
- `url_notificaciones_cambios_contrato`: necesario para recibir cambios de estado/subestado.
- `referencia_externa`: recomendable siempre. Debe ser unica por intento interno.

Ambas URLs deben contener el subdominio publico del tenant para que, al recibir el webhook, podamos resolver el branch/base Turso correcto. No usar una URL global compartida sin tenant.

Formato recomendado:

- `callback_url`: `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratacion`
- `url_notificaciones_cambios_contrato`: `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratos`

La URL exacta participa en la firma HMAC de Imagina, por lo que protocolo, host, path y query deben coincidir exactamente entre la URL enviada a Imagina y la URL reconstruida durante la validacion.

## Residencial

Campos obligatorios especificos:

- `nombre_titular`.
- `tipo_documento_titular`: `NIF`, `NIE`, `CIF` o `Pasaporte` segun OpenAPI.
- `numero_documento_titular`.
- `telefono_titular`, `prefijo_telefono_titular`, `email_titular`.

Campos opcionales relevantes:

- `primer_apellido_titular`.
- `telefono_firmante`, `email_firmante`.
- `tipo_autoconsumo_cnmc`.
- `no_credit_check`.
- `no_enviar_firma`.
- `inicio_contrato`, `fecha_inicio`.
- `fecha_firma_datos`.
- `es_alta_nueva`, `mismo_titular`, `misma_potencia`.

## Prevalidacion del mapper

Antes de llamar a Imagina, nuestro endpoint interno debe validar que el contrato local tiene todos los datos obligatorios que no se deducen automaticamente.

| Dato | Origen esperado en Negoco | Regla |
| --- | --- | --- |
| `id_tarifa` | `comercializadora_rates.external_rate_id` de una tarifa Imagina seleccionada/sincronizada | Bloquear envio si no hay tarifa Imagina seleccionada |
| Potencias P1..P6 | `contracts.pot1..pot6` | Convertir/validar unidad antes de enviar `potencia_contratada` |
| Direccion CNMC | Datos de contrato y normalizacion local | Imagina requiere `tipo_via_cnmc`, calle, numero, municipio, provincia y CP; no basta una direccion libre si faltan piezas |
| CNAE | Datos del cliente/empresa | Obligatorio en `/contrato/empresa` |
| Firmante empresa | Tabla/datos de firmante | Obligatorio en `/contrato/empresa` para la persona fisica que firma |

Esta prevalidacion no es la misma que la elegibilidad para mostrar el switch. La elegibilidad solo comprueba comercializadora Imagina + integracion tenant configurada. La prevalidacion de envio debe ejecutarse en servidor justo antes del `POST /contrato/*` y devolver errores accionables.

### Matriz de datos disponibles y huecos

| Bloque Imagina | Datos que ya tenemos | Huecos o decisiones necesarias |
| --- | --- | --- |
| Tenant/canal | `integrations.config.x_canal_id` | Crear tabla `integrations` y cargar `x_canal_id` por tenant |
| Comercializadora | `contracts.new_company` + tabla `comercializadoras` | Resolver por nombre normalizado, no por ID fijo |
| Tarifa | Tabla `comercializadora_rates` preparada | Sincronizar `GET /tarifas`, guardar `external_rate_id`, y asociar una tarifa Imagina al contrato antes de enviar |
| Punto de suministro | `contracts.CUPS`, `province`, `city`, `postal_code`, `address`, `pot1..pot6` | Falta direccion estructurada: `tipo_via_cnmc`, `calle`, `numero_finca`. Hay que normalizar o pedir esos campos |
| Potencias | `contracts.pot1..pot6` | Confirmar unidad local. La API pide W; si guardamos kW, convertir multiplicando por 1000 |
| Titular residencial | `clients.name`, `last_name`, `document_type`, `document_number`, `phone`, `email`, `IBAN` | Mapear `DNI` a `NIF`; decidir que hacer con `Otro`; prefijo telefonico por defecto `34` o nuevo campo |
| Direccion titular | `clients.address`, `postal_code`, `province`, `city` | Igual que suministro: falta estructura CNMC y `numero_finca_titular` si no se puede extraer con seguridad |
| Empresa | `clients.name`, `document_number`, `phone`, `email`, `IBAN` | Falta `id_cnae`; razon social probablemente sera `clients.name`, pero hay que validarlo por tipo de cliente |
| Firmante empresa | Tabla `signers`: nombre, apellidos, email, telefono, documento, cargo | Falta `tipo_documento_firmante` y prefijo; podemos inferir NIF/NIE solo si validamos formato, pero es mejor guardarlo |
| Firma | `email`/`phone` de titular o firmante | Decidir `canal_envio` por defecto. Recomendado: `email` |
| Tipo de operacion | `contracts.type` | Mapear a flags `es_alta_nueva`, `mismo_titular`, `misma_potencia` |

### Resultado de validacion recomendado

El endpoint interno de envio debe devolver un resultado estructurado si faltan datos:

```json
{
  "success": false,
  "error": "El contrato no tiene todos los datos requeridos para Imagina Energia",
  "missing": [
    {
      "field": "id_tarifa",
      "source": "comercializadora_rates",
      "message": "Selecciona una tarifa de Imagina Energia sincronizada"
    },
    {
      "field": "tipo_via_cnmc",
      "source": "contracts",
      "message": "Completa el tipo de via CNMC del punto de suministro"
    }
  ]
}
```

El frontend puede mostrar estos errores al usuario, pero la validacion debe vivir en servidor para evitar enviar payloads incompletos a Imagina.

## Empresa

Campos obligatorios especificos:

- `id_cnae`.
- `razon_social_titular`.
- `numero_documento_titular` para NIF/CIF de empresa.
- `telefono_titular`, `prefijo_telefono_titular`, `email_titular`.
- Datos de firmante: `nombre_firmante`, `primer_apellido_firmante`, `tipo_documento_firmante`, `numero_documento_firmante`, `prefijo_telefono_firmante`.

Campos opcionales relevantes:

- `telefono_firmante`, `email_firmante`. Si faltan, se usan los del titular cuando aplica.
- `aclarador_finca` y `aclarador_finca_titular`.
- Resto de flags comunes.

## Modelos C1, C2 y A3

La API usa tres flags:

| Modelo | Descripcion | `es_alta_nueva` | `mismo_titular` | `misma_potencia` |
| --- | --- | --- | --- | --- |
| C1 | Cambio de comercializadora sin cambios tecnicos | `false` | `true` | `true` |
| C2 | Cambio con cambio de potencia u otros cambios tecnicos | `false` | `true` | `false` |
| C2 | Cambio con cambio de titular | `false` | `false` | `true` |
| A3 | Nueva alta de suministro | `true` | `true` | no determinante |

Si se omiten, la guia indica que el sistema asume C1.

## Opciones de fechas y firma

| Campo | Regla |
| --- | --- |
| `inicio_contrato` | `cuanto_antes` o `fecha_fija`. Default `cuanto_antes` |
| `fecha_inicio` | Obligatorio si `inicio_contrato = fecha_fija` |
| `no_enviar_firma` | Si `true`, no envia a firma durante el alta |
| `fecha_firma_datos` | Obligatorio si `no_enviar_firma = true` |
| `years_vigencia` | La guia lo menciona con default 1, pero no aparece en el schema OpenAPI actual |

La documentacion tiene una tension entre dos puntos: el schema describe `fecha_firma_datos` como obligatorio cuando `no_enviar_firma = true`, pero la guia de `POST /firma` documenta precisamente el flujo de crear contrato con `no_enviar_firma: true` y enviar firma mas tarde. Decision operativa por defecto: usar firma automatica y no enviar `no_enviar_firma: true` en el flujo normal de alta.

## Decision de firma en Negoco

En `UpdateTramiteStatusModal.tsx` mostraremos un unico switch cuando el destino sea `Verificado`, el contrato resuelva a Imagina Energia y el tenant tenga la integracion configurada:

- Enviar contrato a Imagina.

Si el usuario activa este switch, el contrato se enviara a Imagina usando su flujo automatico de firma. Por tanto, el alta no debe incluir `no_enviar_firma: true`.

Flujo operativo por defecto:

1. Enviar alta sin `no_enviar_firma: true`.
2. Al recibir callback con `credit_result` aprobado, `contrato_result` correcto y `firma_result` correcto, guardar `contrato_id`, `codigo` y `circuito_id` si viene.
3. Pasar el tramite a `Pendiente de Firma`.
4. Cuando llegue notificacion de firmado, pasar a `Procesando`.
5. Cuando llegue notificacion de activo, pasar a `Activo`.

Flujo diferido/manual:

Si permitimos no enviar la firma con el alta, no debemos reutilizar `Pendiente de Firma` para representar ese caso, porque todavia no hay firma enviada al cliente. Antes hay que anadir un estado Negoco especifico, por ejemplo `Pendiente de Envio de Firma`, y entonces activar el flujo con `no_enviar_firma: true` + accion posterior `POST /firma`.

## Notificaciones de cambios

La guia de notificaciones indica que se puede incluir `url_notificaciones_cambios_contrato` al crear contrato para suscribirse a cambios de estado/subestado. Este campo no aparece en el schema OpenAPI actual, pero es imprescindible para actualizacion de estados por webhook.

Decision interna: soportar el campo como extension controlada en nuestro mapper, aunque no este en el YAML.

La URL enviada en `url_notificaciones_cambios_contrato` debe ser tenant-aware mediante subdominio. Esa sera la fuente para resolver el tenant al recibir notificaciones automaticas.

## Respuesta inicial

Respuesta asincrona esperada:

```json
{
  "message": "Request is being processed asynchronously",
  "request_id": 12345
}
```

Guardar `request_id` inmediatamente junto con nuestro tramite/contrato local y `referencia_externa`.

## Callback de alta

El callback contiene:

- `request_id`.
- `referencia_externa`.
- `credit_result`.
- `contrato_result`.
- `firma_result`.
- `_callback_signature` segun guias actuales.

Ver [04 - Webhooks, callbacks y estados](04-webhooks-callbacks-y-estados.md) para validacion HMAC y estructura completa.
