# AWS EKS Deployment Guide

## Phase 3: Cloud Infrastructure Deployment

This guide provides step-by-step instructions for deploying the Autonomous Orchestrator on AWS EKS.

## Prerequisites

- AWS Account with appropriate IAM permissions
- AWS CLI configured (v2.x or later)
- kubectl configured
- Docker installed locally

## Step 1: Deploy EKS Cluster via CloudFormation

Template: autonomous-system/07-cloudformation-eks.yaml

Parameters:
- ClusterName: autonomous-orchestrator-eks
- NodeGroupSize: 3
- NodeInstanceType: t3.medium

## Step 2: Configure kubectl

aws eks update-kubeconfig --name autonomous-orchestrator-eks --region eu-central-1

## Step 3: Push Docker Images to ECR

See autonomous-system/03-Dockerfile for image build instructions.

## Step 4: Deploy Orchestrator to EKS

Kubernetes manifests in k8s/deployment.yaml

## Step 5: Setup Monitoring

Prometheus + Grafana stack configuration included.

## Security Best Practices

- Use IAM roles for EKS service accounts
- Enable encryption at rest for EBS volumes
- Implement RBAC policies
- Regular security updates
