#!/usr/bin/env bash
# ==============================================================================
# LiveScribe Google Cloud Run Deployment Script
# Secure automated build and deployment with Google Cloud Secret Manager
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration Variables (Specify your Google Cloud details here)
# ------------------------------------------------------------------------------
PROJECT_ID="YOUR_PROJECT_ID"
REGION="us-central1"
SERVICE_NAME="livescribe"

if [[ "$PROJECT_ID" == "YOUR_PROJECT_ID" ]]; then
  echo "Error: Please edit deploy/cloudrun.sh and set your real GCP PROJECT_ID." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Error: .env file not found in current directory. Cannot read secrets." >&2
  exit 1
fi

echo "=========================================================="
echo "🚀 Deploying LiveScribe to Google Cloud Run"
echo "   Project:  ${PROJECT_ID}"
echo "   Region:   ${REGION}"
echo "   Service:  ${SERVICE_NAME}"
echo "=========================================================="

# 1. Select Google Cloud project
echo "Step 1: Setting active Google Cloud project..."
gcloud config set project "${PROJECT_ID}"

# 2. Enable necessary Google Cloud APIs
echo "Step 2: Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# 3. Create or update secrets in Secret Manager directly via stdin (NO SECRETS LOGGED)
echo "Step 3: Storing GEMINI_API_KEY in Secret Manager..."
if gcloud secrets describe gemini-api-key >/dev/null 2>&1; then
  grep -E '^GEMINI_API_KEY=' .env | cut -d '=' -f2- | tr -d '\r\n"' | gcloud secrets versions add gemini-api-key --data-file=-
else
  grep -E '^GEMINI_API_KEY=' .env | cut -d '=' -f2- | tr -d '\r\n"' | gcloud secrets create gemini-api-key --data-file=-
fi

echo "Step 4: Storing APP_PASSWORD in Secret Manager..."
if gcloud secrets describe app-password >/dev/null 2>&1; then
  grep -E '^APP_PASSWORD=' .env | cut -d '=' -f2- | tr -d '\r\n"' | gcloud secrets versions add app-password --data-file=-
else
  grep -E '^APP_PASSWORD=' .env | cut -d '=' -f2- | tr -d '\r\n"' | gcloud secrets create app-password --data-file=-
fi

# 4. Grant Secret Manager access to default Cloud Run runtime service account
echo "Step 5: Configuring Cloud Run Service Account permissions..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

# 5. Build and deploy container image from source with Cloud Run
echo "Step 6: Deploying Cloud Run service from source..."
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --max-instances 2 \
  --concurrency 80 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,APP_PASSWORD=app-password:latest \
  --set-env-vars NODE_ENV=production,TRUST_PROXY_HOPS=1,ALLOWED_ORIGIN="http://localhost"

# 6. Retrieve deployed public service URL and update ALLOWED_ORIGIN to match
echo "Step 7: Updating ALLOWED_ORIGIN to deployed Cloud Run URL..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --format='value(status.url)')

gcloud run services update "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --update-env-vars ALLOWED_ORIGIN="${SERVICE_URL}"

echo "=========================================================="
echo "✅ LiveScribe successfully deployed!"
echo "   Public URL: ${SERVICE_URL}"
echo "=========================================================="
