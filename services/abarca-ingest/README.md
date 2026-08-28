# abarca-ingest

Proxy de ingesta del webhook de Abarca.

## Por qué existe

El CRM está en Vercel, que **corta el cuerpo de la petición en ~4,5MB en el
edge**, antes de ejecutar la función. Abarca no tiene ese límite: cuando un
comercial subía un DNI grande desde el comparador, la entrega entera moría con
`FUNCTION_PAYLOAD_TOO_LARGE` — no solo la foto, también el estudio, el SIPS y
los datos del titular — y en nuestros logs no quedaba ni rastro, porque la
petición nunca llegaba a ejecutarse.

Este servicio se pone delante: recibe el payload completo (Cloud Run admite
32MB), deja los documentos en Firebase Storage y reenvía al CRM un JSON
pequeño con las referencias. Abarca solo tiene que cambiar la URL del webhook.

```
Abarca ──(payload con base64, hasta 32MB)──► abarca-ingest ──► Firebase Storage
                                                   │
                                                   └──(JSON sin base64)──► CRM en Vercel
```

## Contrato

Entrada: exactamente la misma que el webhook del CRM hoy — cabeceras
`x-api-key`, `x-tenant`, `x-comparativa-id` y el mismo JSON.

Salida hacia el CRM: el mismo JSON, con cada documento sustituido por

```json
{
  "path": "abarca-inbox/<tenant>/<comparativa>/<uuid>/dni_photo_back.png",
  "url": "https://firebasestorage.googleapis.com/...",
  "bytes": 2481923,
  "content_type": "image/png",
  "sha256": "..."
}
```

El CRM responde y esa respuesta se devuelve a Abarca tal cual, así que los
reintentos siguen funcionando igual que antes.

Reglas que este servicio garantiza:

- **Ningún fichero se descarta.** Lo que no es base64 válido se sube tal cual
  como `.bin` y el CRM lo marca en cuarentena.
- **Nada se reenvía sin estar guardado.** Si Storage falla, responde 503 para
  que Abarca reintente, en vez de cerrar la comparativa sin documentos.
- **El original solo lo borra el CRM**, y solo cuando ya ha guardado su copia
  definitiva en la carpeta de la comparativa.

## Despliegue (Cloud Run)

```bash
cd services/abarca-ingest
./deploy.sh --dry-run   # muestra qué se va a desplegar, sin tocar nada
./deploy.sh
```

El script lee `.env.local` del CRM y traduce los nombres de las variables
(`NEXT_FIREBASE_*` → `FIREBASE_*`), así que no hay que copiar secretos a mano
ni dejarlos en el historial del shell. También habilita las APIs necesarias
(`run`, `cloudbuild`, `artifactregistry`), que en el proyecto `negoco-crm-c57a3`
no lo estaban.

Valores por defecto, todos sobreescribibles por variable de entorno:

| Variable | Por defecto |
|---|---|
| `GCP_PROJECT` | `negoco-crm-c57a3` (el mismo de Firebase) |
| `GCP_REGION` | `europe-southwest1` (Madrid) |
| `CRM_WEBHOOK_URL` | `https://api.negococloud.es/api/webhooks/abarca` |
| `ENV_FILE` | `../../.env.local` |

`--allow-unauthenticated` es necesario porque quien llama es Abarca; la
autorización real la hace `x-api-key`, igual que en el webhook actual.

Las variables quedan en la configuración del servicio, visibles para quien
tenga acceso al proyecto — el mismo modelo que las de Vercel. Si quieres
endurecerlo, `ABARCA_API_KEY` puede pasarse por Secret Manager con
`--set-secrets` en lugar de `--env-vars-file`.

### Después de desplegar

1. **Verificar el límite real** antes de dar el cambio por bueno. No te fíes de
   la documentación: mándale un cuerpo que Vercel rechazaría y comprueba que
   llega.

   ```bash
   ./smoke-test.sh <url-del-proxy> <tenant> <comparativa-id-en-pending>
   ```

   Envía un JPEG válido de 12MB (`MB=20` para forzar más). Un 200 significa que
   el fichero llegó a Storage y el CRM cerró la entrega; la comparativa debe
   quedar en `awaiting_review` con `dni_reverso.jpg` entre sus documentos.

2. **Dar la URL a Abarca** para que apunte ahí su webhook. Mientras no lo hagan,
   el webhook actual sigue funcionando con los payloads que caben en 4,5MB.

3. **Regla de ciclo de vida** en el bucket para `abarca-inbox/`: borrar objetos
   con más de 7 días. Es la red de seguridad para los originales que queden
   huérfanos si una entrega no llega a completarse.

## Tests

```bash
npm test
```

## Nota de mantenimiento

`src/documents.js` es una copia deliberada de la parte pura de
`src/comparativas/utils/abarca-documents.ts` del CRM: este servicio se
despliega por separado y no comparte build. Si cambian los formatos aceptados
(hoy JPG, PNG y PDF), hay que tocar los dos ficheros.
