#!/bin/bash

# Docker Build & Kubernetes Deployment Script
# Phase 3: Container Image Build and Orchestration Deployment
# Project: Civic Digital Infrastructure Platform

set -e

# Configuration
REGION="eu-central-1"
IMAGE_NAME="autonomous-orchestrator"
IMAGE_TAG="latest"
DOCKERFILE_PATH="autonomous-system/03-Dockerfile"
K8S_MANIFEST="k8s/deployment.yaml"
NAMESPACE="default"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Docker Build and Kubernetes Deployment..."

# Step 1: Get AWS Account ID
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Getting AWS Account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Step 2: Build Docker image
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Building Docker image..."
cd autonomous-system
docker build -f $(basename "$DOCKERFILE_PATH") -t "$IMAGE_NAME:$IMAGE_TAG" .
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Docker image built successfully"
cd ..

# Step 3: Tag Docker image for ECR
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tagging image for ECR..."
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$IMAGE_NAME:$IMAGE_TAG"
docker tag "$IMAGE_NAME:$IMAGE_TAG" "$ECR_URI"
echo "ECR URI: $ECR_URI"

# Step 4: Login to ECR
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Logging into ECR..."
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Step 5: Push to ECR
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pushing Docker image to ECR..."
docker push "$ECR_URI"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Docker image pushed successfully"

# Step 6: Update Kubernetes manifest with image URI
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updating Kubernetes manifest..."
TEMP_MANIFEST=$(mktemp)
sed "s|IMAGE_URI|$ECR_URI|g" "$K8S_MANIFEST" > "$TEMP_MANIFEST"
mv "$TEMP_MANIFEST" "$K8S_MANIFEST"
echo "Kubernetes manifest updated with image: $ECR_URI"

# Step 7: Deploy to Kubernetes
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploying to Kubernetes..."
kubectl apply -f "$K8S_MANIFEST" -n "$NAMESPACE"

# Step 8: Wait for deployment
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for deployment to be ready..."
kubectl rollout status deployment/autonomous-orchestrator -n "$NAMESPACE" --timeout=5m

# Step 9: Verify deployment
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying deployment..."
echo ""
echo "Deployment Status:"
kubectl get deployment -n "$NAMESPACE"
echo ""
echo "Pod Status:"
kubectl get pods -n "$NAMESPACE"
echo ""
echo "Pod Details:"
kubectl describe pods -n "$NAMESPACE" -l app=autonomous-orchestrator

# Step 10: Check logs
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Fetching pod logs..."
echo ""
POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=autonomous-orchestrator -o jsonpath='{.items[0].metadata.name}')
if [ -n "$POD_NAME" ]; then
  echo "Pod: $POD_NAME"
  echo "Logs:"
  kubectl logs "$POD_NAME" -n "$NAMESPACE" || echo "Logs not yet available"
fi

echo ""
echo "============================================"
echo "SUCCESS: Docker & Kubernetes Deployment Complete!"
echo "============================================"
echo ""
echo "Deployed Image: $ECR_URI"
echo "Namespace: $NAMESPACE"
echo ""
echo "Next Steps:"
echo "1. Verify pods are Running"
echo "2. Install Prometheus monitoring"
echo "3. Configure Slack webhooks"
echo "4. Execute end-to-end test"
echo ""
echo "Useful Commands:"
echo "kubectl get pods -n $NAMESPACE"
echo "kubectl logs deployment/autonomous-orchestrator -n $NAMESPACE"
echo "kubectl describe deployment autonomous-orchestrator -n $NAMESPACE"
echo "kubectl exec -it <pod-name> -n $NAMESPACE -- /bin/bash"
echo ""
