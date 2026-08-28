#!/usr/bin/env bash
#
# Despliega el proxy de ingesta en Cloud Run.
#
# Lee la configuración de .env.local del CRM para no tener que copiar secretos
# a mano ni dejarlos en el historial del shell.
#
#   ./deploy.sh --dry-run   muestra qué se va a desplegar, sin tocar nada
#   ./deploy.sh             despliega
#
set -euo pipefail

cd "$(dirname "$0")"

PROJECT="${GCP_PROJECT:-negoco-crm-c57a3}"
REGION="${GCP_REGION:-europe-southwest1}"
SERVICE="${SERVICE_NAME:-abarca-ingest}"
ENV_FILE="${ENV_FILE:-../../.env.local}"
CRM_WEBHOOK_URL="${CRM_WEBHOOK_URL:-https://api.negococloud.es/api/webhooks/abarca}"

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

if [ ! -f "$ENV_FILE" ]; then
  echo "No encuentro $ENV_FILE. Usa ENV_FILE=/ruta/al/.env para apuntarlo." >&2
  exit 1
fi

read_env() {
  local key="$1" line value
  line=$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)
  if [ -z "$line" ]; then
    echo "Falta $key en $ENV_FILE" >&2
    exit 1
  fi
  value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "$value"
}

# Nombres del CRM -> nombres que espera el servicio
ABARCA_API_KEY=$(read_env ABARCA_API_KEY)
FIREBASE_API_KEY=$(read_env NEXT_FIREBASE_API_KEY)
FIREBASE_APP_ID=$(read_env NEXT_FIREBASE_APP_ID)
FIREBASE_AUTH_DOMAIN=$(read_env NEXT_FIREBASE_AUTH_DOMAIN)
FIREBASE_MESSAGING_SENDER_ID=$(read_env NEXT_FIREBASE_MESSAGING_SENDER_ID)
FIREBASE_PROJECT_ID=$(read_env NEXT_FIREBASE_PROJECT_ID)
FIREBASE_STORAGE_BUCKET=$(read_env NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)

echo "Proyecto : $PROJECT"
echo "Región   : $REGION"
echo "Servicio : $SERVICE"
echo "Destino  : $CRM_WEBHOOK_URL"
echo "Bucket   : $FIREBASE_STORAGE_BUCKET"
echo "Secretos : ABARCA_API_KEY (${#ABARCA_API_KEY} caracteres), config de Firebase leída de $ENV_FILE"

if [ "$DRY_RUN" = true ]; then
  echo
  echo "--dry-run: no se despliega nada."
  exit 0
fi

# El fichero de variables evita problemas con valores que llevan comas.
ENV_YAML=$(mktemp -t abarca-ingest-env)
trap 'rm -f "$ENV_YAML"' EXIT
yaml_line() { printf "%s: '%s'\n" "$1" "${2//\'/\'\'}" >> "$ENV_YAML"; }
yaml_line ABARCA_API_KEY "$ABARCA_API_KEY"
yaml_line CRM_WEBHOOK_URL "$CRM_WEBHOOK_URL"
yaml_line FIREBASE_API_KEY "$FIREBASE_API_KEY"
yaml_line FIREBASE_APP_ID "$FIREBASE_APP_ID"
yaml_line FIREBASE_AUTH_DOMAIN "$FIREBASE_AUTH_DOMAIN"
yaml_line FIREBASE_MESSAGING_SENDER_ID "$FIREBASE_MESSAGING_SENDER_ID"
yaml_line FIREBASE_PROJECT_ID "$FIREBASE_PROJECT_ID"
yaml_line FIREBASE_STORAGE_BUCKET "$FIREBASE_STORAGE_BUCKET"

echo
echo "==> Habilitando APIs (idempotente)"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project "$PROJECT"

# Cloud Build construye con la cuenta de servicio por defecto de Compute, y
# desde su migración exige el rol `cloudbuild.builds.builder` de forma
# explícita: tener `roles/editor` no basta, aunque cubra los permisos por
# debajo. Sin esto el despliegue muere con PERMISSION_DENIED al leer el zip del
# código fuente. Con SKIP_IAM=true se omite (por si lo concede otra persona).
if [ "${SKIP_IAM:-false}" != "true" ]; then
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')
  BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

  if gcloud projects get-iam-policy "$PROJECT" \
      --flatten="bindings[].members" \
      --filter="bindings.members:${BUILD_SA} AND bindings.role:roles/cloudbuild.builds.builder" \
      --format="value(bindings.role)" | grep -q .; then
    echo
    echo "==> Permisos de build correctos"
  else
    echo
    echo "==> Concediendo roles/cloudbuild.builds.builder a $BUILD_SA"
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member="serviceAccount:${BUILD_SA}" \
      --role="roles/cloudbuild.builds.builder" \
      --condition=None >/dev/null
    echo "    Hecho. Esperando propagación de IAM (hasta un minuto)."
    sleep 45
  fi
fi

echo
echo "==> Desplegando"
deploy() {
  gcloud run deploy "$SERVICE" \
    --source . \
    --project "$PROJECT" \
    --region "$REGION" \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 600 \
    --max-instances 10 \
    --env-vars-file "$ENV_YAML"
}

# El permiso recién concedido tarda en propagarse: un reintento evita tener que
# relanzar el script a mano.
if ! deploy; then
  echo
  echo "==> Primer intento fallido. Reintento en 60s por si es propagación de IAM."
  sleep 60
  deploy
fi

URL=$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT" --region "$REGION" \
  --format 'value(status.url)')

echo
echo "Desplegado en: $URL"
echo
echo "Siguiente paso — comprobar que acepta un cuerpo que Vercel rechazaría:"
echo "  ./smoke-test.sh $URL <tenant> <comparativa-id>"
echo
echo "Y después: dar esta URL a Abarca para su webhook, y poner una regla de"
echo "ciclo de vida de 7 días en el prefijo abarca-inbox/ del bucket."
