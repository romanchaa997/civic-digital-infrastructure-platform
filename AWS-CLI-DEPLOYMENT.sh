#!/bin/bash

# AWS EKS Cluster Deployment Script
# Phase 3: Production Infrastructure Deployment
# Project: Civic Digital Infrastructure Platform

set -e

# Configuration
CLUSTER_NAME="autonomous-orchestrator-eks"
REGION="eu-central-1"
STACK_NAME="autonomous-orchestrator-eks"
TEMPLATE_URL="https://raw.githubusercontent.com/romanchaa997/civic-digital-infrastructure-platform/main/autonomous-system/07-cloudformation-eks.yaml"
NODE_COUNT=3
NODE_TYPE="t3.medium"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting EKS Cluster Deployment..."
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo "Cluster Name: $CLUSTER_NAME"

# Step 1: Download CloudFormation template
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Downloading CloudFormation template..."
TEMPLATE_FILE="eks-template.yaml"
wget -O "$TEMPLATE_FILE" "$TEMPLATE_URL"

# Step 2: Create CloudFormation stack
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating CloudFormation stack..."
aws cloudformation create-stack \
  --stack-name "$STACK_NAME" \
  --template-body "file://$TEMPLATE_FILE" \
  --parameters \
    ParameterKey=ClusterName,ParameterValue="$CLUSTER_NAME" \
    ParameterKey=NodeGroupSize,ParameterValue="$NODE_COUNT" \
    ParameterKey=NodeInstanceType,ParameterValue="$NODE_TYPE" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags Key=Environment,Value=Production Key=Project,Value=CivicDigitalPlatform

# Step 3: Wait for stack creation
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for stack creation (this may take 15-20 minutes)..."
aws cloudformation wait stack-create-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] CloudFormation stack creation completed!"

# Step 4: Configure kubectl
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Configuring kubectl..."
aws eks update-kubeconfig \
  --name "$CLUSTER_NAME" \
  --region "$REGION"

# Step 5: Verify cluster access
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying cluster access..."
kubectl get nodes
kubectl get pods --all-namespaces

# Step 6: Create ECR repository
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating ECR repository..."
aws ecr create-repository \
  --repository-name autonomous-orchestrator \
  --region "$REGION" || echo "Repository may already exist"

# Step 7: Get AWS Account ID for image URI
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] AWS Account ID: $ACCOUNT_ID"

echo ""
echo "============================================"
echo "SUCCESS: EKS Cluster Deployment Completed!"
echo "============================================"
echo ""
echo "Next Steps:"
echo "1. Build and push Docker image to ECR"
echo "2. Deploy orchestrator pods to Kubernetes"
echo "3. Install Prometheus + Grafana monitoring"
echo "4. Configure Slack webhooks"
echo "5. Execute end-to-end test"
echo ""
echo "Docker Build Command:"
echo "cd autonomous-system"
echo "docker build -f 03-Dockerfile -t autonomous-orchestrator:latest ."
echo "docker tag autonomous-orchestrator:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/autonomous-orchestrator:latest"
echo "docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/autonomous-orchestrator:latest"
echo ""
echo "Kubernetes Deployment Command:"
echo "kubectl apply -f k8s/deployment.yaml"
echo ""
