#!/bin/bash
# ClawHealth GCP Cloud Run Deploy Script
# Usage: ./gcp/deploy.sh [tag]

set -e

PROJECT_ID="sacred-evening-485804-u0"
REGION="us-east1"
SERVICE_NAME="clawhealth-agents"
REPO="us-east1-docker.pkg.dev/$PROJECT_ID/clawhealth/app"
TAG=${1:-$(git rev-parse --short HEAD)}

echo "🚀 Deploying ClawHealth to Cloud Run"
echo "Tag: $TAG"

# Configure Docker auth
gcloud auth configure-docker us-east1-docker.pkg.dev --quiet

# Build + push
echo "🐳 Building Docker image..."
docker build -t "$REPO:$TAG" -t "$REPO:latest" .

echo "📤 Pushing to Artifact Registry..."
docker push "$REPO:$TAG"
docker push "$REPO:latest"

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image="$REPO:$TAG" \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=1 \
  --port=8080 \
  --timeout=300 \
  --set-secrets="DATABASE_URL=clawhealth-DATABASE_URL:latest,\
DIRECT_URL=clawhealth-DIRECT_URL:latest,\
ANTHROPIC_API_KEY=clawhealth-ANTHROPIC_API_KEY:latest,\
ENCRYPTION_KEY=clawhealth-ENCRYPTION_KEY:latest,\
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=clawhealth-CLERK_PUBLISHABLE_KEY:latest,\
CLERK_SECRET_KEY=clawhealth-CLERK_SECRET_KEY:latest,\
ELEVENLABS_API_KEY=clawhealth-ELEVENLABS_API_KEY:latest" \
  --quiet

URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
echo ""
echo "✅ Deployed: $URL"
echo "   Voice webhook: $URL/api/voice"
echo "   Health check:  $URL/api/health"
