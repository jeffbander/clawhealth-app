#!/bin/bash
# ClawHealth GCP Setup Script
# Run once to configure Cloud Run infrastructure
# Usage: ./gcp/setup.sh

set -e

PROJECT_ID="sacred-evening-485804-u0"
REGION="us-east1"
SERVICE_NAME="clawhealth-agents"
SA_NAME="clawhealth-sa"
REPO_NAME="clawhealth"

echo "🏥 ClawHealth GCP Setup"
echo "Project: $PROJECT_ID | Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📦 Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --quiet

# Create Artifact Registry repo for Docker images
echo "🐳 Creating Artifact Registry..."
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="ClawHealth container images" \
  --quiet 2>/dev/null || echo "  (already exists)"

# Create service account
echo "🔑 Creating service account..."
gcloud iam service-accounts create $SA_NAME \
  --display-name="ClawHealth Service Account" \
  --quiet 2>/dev/null || echo "  (already exists)"

SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Grant required roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.invoker" --quiet

# Create secrets (you'll populate these with actual values)
echo "🔐 Creating Secret Manager secrets..."
for secret in DATABASE_URL DIRECT_URL ANTHROPIC_API_KEY ENCRYPTION_KEY CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY ELEVENLABS_API_KEY; do
  gcloud secrets create "clawhealth-$secret" --quiet 2>/dev/null || echo "  $secret already exists"
done

echo ""
echo "✅ GCP infrastructure ready!"
echo ""
echo "📋 Next: Populate secrets with:"
echo "   echo -n 'your-value' | gcloud secrets versions add clawhealth-DATABASE_URL --data-file=-"
echo "   echo -n 'your-value' | gcloud secrets versions add clawhealth-ANTHROPIC_API_KEY --data-file=-"
echo "   (repeat for each secret)"
echo ""
echo "🚀 Then deploy with:"
echo "   ./gcp/deploy.sh"
