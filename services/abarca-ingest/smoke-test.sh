#!/usr/bin/env bash
#
# Comprueba que el proxy traga un cuerpo que Vercel rechazaría de plano.
#
#   ./smoke-test.sh <url-del-proxy> <tenant>
#       Nivel 1, sin efectos: usa una identidad inexistente, así que el CRM
#       contesta 403 sin tocar ningún dato. Lo que se comprueba es que
#       CONTESTA: si el JSON de 16MB hubiera ido directo a Vercel, la petición
#       habría muerto en el edge con FUNCTION_PAYLOAD_TOO_LARGE.
#
#   ./smoke-test.sh <url-del-proxy> <tenant> <comparativa-id> <crm-id>
#       Nivel 2, de verdad: completa la entrega. La comparativa debe estar en
#       "pending" y crm_id ser el abarca_user_id de la organización (o de un
#       comercial). Al terminar debe quedar en "awaiting_review" con
#       dni_reverso.jpg entre sus documentos.
#
set -euo pipefail

cd "$(dirname "$0")"

URL="${1:?Falta la URL del proxy}"
TENANT="${2:?Falta el tenant (beenergy | nasertel)}"
COMPARATIVA_ID="${3:-smoke-test-inexistente}"
CRM_ID="${4:-999999}"
ENV_FILE="${ENV_FILE:-../../.env.local}"
MB="${MB:-12}"

if [ -n "${3:-}" ]; then
  LEVEL="2 (entrega real sobre $COMPARATIVA_ID)"
  EXPECTED="200"
else
  LEVEL="1 (sin efectos)"
  EXPECTED="403"
fi

API_KEY=$(grep -E "^ABARCA_API_KEY=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
  | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

PAYLOAD=$(mktemp -t abarca-smoke)
trap 'rm -f "$PAYLOAD"' EXIT

# JPEG válido de MB megas: cabecera y marcador de fin reales, relleno en medio.
# El proxy debe reconocerlo como image/jpeg y subirlo a Storage.
node -e '
const [mb, crmId] = process.argv.slice(1);
const size = Number(mb) * 1024 * 1024;
const jpeg = Buffer.alloc(size, 0x20);
jpeg.set([0xff, 0xd8, 0xff, 0xe0], 0);
jpeg.set([0xff, 0xd9], size - 2);
process.stdout.write(
  JSON.stringify({
    ide: 999999,
    crm_id: Number(crmId),
    empresa: "Prueba ingesta",
    dni_photo_back: jpeg.toString("base64"),
  }),
);
' "$MB" "$CRM_ID" > "$PAYLOAD"

echo "Nivel    : $LEVEL"
echo "Tamaño   : $(du -h "$PAYLOAD" | cut -f1) (Vercel corta en 4,5MB)"
echo "Esperado : HTTP $EXPECTED"
echo

STATUS=$(curl -sS -o /tmp/abarca-smoke-response -w '%{http_code}' \
  -X POST "$URL" \
  -H "x-api-key: $API_KEY" \
  -H "x-tenant: $TENANT" \
  -H "x-comparativa-id: $COMPARATIVA_ID" \
  -H "content-type: application/json" \
  --data-binary "@$PAYLOAD")

echo "HTTP $STATUS"
cat /tmp/abarca-smoke-response
echo
echo

case "$STATUS" in
  "$EXPECTED")
    echo "✅ El cuerpo atravesó el proxy y el CRM respondió."
    [ "$EXPECTED" = "403" ] && echo "   (el 403 es la identidad falsa: es lo que buscábamos)"
    ;;
  413)
    echo "❌ 413: el límite sigue ahí. Mira si la respuesta viene del proxy"
    echo "   (JSON con 'Payload too large') o del edge de Vercel (HTML)."
    ;;
  401) echo "❌ 401: ABARCA_API_KEY no coincide con la desplegada." ;;
  404) echo "⚠️  404: llegó al CRM, pero esa comparativa no existe en $TENANT." ;;
  503) echo "❌ 503: el proxy no pudo subir a Storage o no alcanzó el CRM." ;;
  *)   echo "⚠️  Respuesta inesperada; revisa los logs." ;;
esac

echo
echo "Logs del proxy (incluyen bytes subidos y estado del reenvío):"
echo "  gcloud run services logs read abarca-ingest \\"
echo "    --project negoco-crm-c57a3 --region europe-southwest1 --limit 30"
