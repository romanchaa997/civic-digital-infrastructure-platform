# Civic Digital Infrastructure Platform - Quick Start Guide

> **Phase 3 Complete:** Full production-ready deployment suite
> **Status:** Ready for immediate deployment
> **Last Updated:** December 7, 2025

## 🚀 Get Started in 60 Minutes

This guide walks you through deploying a complete autonomous orchestration platform connecting GitHub, Jira, Notion, ClickUp, Kubernetes, and real-time monitoring.

## 📋 Prerequisites

- **AWS Account** with permissions for EC2, EKS, ECR, CloudFormation, IAM
- **AWS CLI v2** installed and configured
- **kubectl** (v1.24+) installed
- **Docker** installed locally
- **Helm** (v3.x) installed
- **Git** installed
- **Slack workspace** with admin access (for webhooks)
- **Zapier account** (for automation workflows)

## ⚡ Quick Start (4 Steps)

### Step 1: Deploy Infrastructure (20 minutes)

```bash
# Clone repository
git clone https://github.com/romanchaa997/civic-digital-infrastructure-platform.git
cd civic-digital-infrastructure-platform

# Make deployment script executable
chmod +x AWS-CLI-DEPLOYMENT.sh

# Deploy EKS cluster (will take 15-20 minutes)
./AWS-CLI-DEPLOYMENT.sh

# Output will show:
# - CloudFormation stack creation
# - kubectl configuration
# - ECR repository creation
# - AWS Account ID for use in next steps
```

### Step 2: Build & Deploy Application (10 minutes)

```bash
# Make deployment script executable
chmod +x DOCKER-K8S-DEPLOYMENT.sh

# Build Docker image and deploy to Kubernetes
./DOCKER-K8S-DEPLOYMENT.sh

# Output will show:
# - Docker image built successfully
# - Image pushed to ECR
# - Kubernetes deployment status
# - Pod health status
```

### Step 3: Setup Monitoring (15 minutes)

```bash
# Make deployment script executable
chmod +x MONITORING-SLACK-SETUP.sh

# Deploy Prometheus and Grafana
./MONITORING-SLACK-SETUP.sh

# Output will show:
# - Prometheus and Grafana installed
# - Port-forward commands
# - Grafana credentials
# - Slack integration instructions
```

### Step 4: Test & Verify (10 minutes)

```bash
# Follow END-TO-END-TEST.md
# - Create test commit
# - Monitor Zapier execution
# - Verify Jira, Notion, ClickUp updates
# - Check Kubernetes logs
# - Verify Prometheus metrics
# - Confirm Slack notifications
```

## 📁 What Gets Deployed

### Infrastructure
- **EKS Cluster:** 3x t3.medium nodes in eu-central-1
- **ECR Repository:** For container images
- **Networking:** VPC with public/private subnets
- **Security:** IAM roles, RBAC, security groups

### Applications
- **Orchestrator Pod:** Python AI agent (2 replicas)
- **Prometheus:** Metrics collection (50GB storage)
- **Grafana:** Dashboards and visualization
- **AlertManager:** Alert routing and webhooks

### Integrations
- **GitHub:** Webhook triggers on commits
- **Zapier:** Multi-service automation workflows
- **Jira:** Issue creation and management
- **Notion:** Database synchronization
- **ClickUp:** Task management integration
- **Slack:** Real-time alert notifications

## 🎯 Deployment Timeline

| Step | Task | Duration | Status |
|------|------|----------|--------|
| 1 | EKS Infrastructure | 15-20 min | ⏳ Running |
| 2 | Docker Build & Deploy | 10-15 min | ⏳ Waiting |
| 3 | Monitoring Setup | 15 min | ⏳ Pending |
| 4 | End-to-End Testing | 10 min | ⏳ Pending |
| **Total** | **Complete Deployment** | **~60 min** | **Ready** |

## 📊 Access Dashboards

After successful deployment:

### Grafana (Monitoring)
```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Visit: http://localhost:3000
# Username: admin
# Password: ChangeMeToSecure123!
```

### Prometheus (Metrics)
```bash
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090
# Visit: http://localhost:9090
```

### AlertManager
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prom-alertmanager 9093:9093
# Visit: http://localhost:9093
```

## 🔍 Verify Deployment

### Check EKS Cluster
```bash
# Get cluster info
aws eks describe-cluster --name autonomous-orchestrator-eks --region eu-central-1

# Get nodes
kubectl get nodes

# Get pods
kubectl get pods --all-namespaces
```

### Check Orchestrator
```bash
# View deployment
kubectl get deployment -n default

# Check pod status
kubectl get pods -n default -l app=autonomous-orchestrator

# View logs
kubectl logs -f deployment/autonomous-orchestrator -n default
```

### Check Monitoring
```bash
# View Prometheus pods
kubectl get pods -n monitoring

# Check Grafana
kubectl get svc -n monitoring
```

## 📚 Documentation

- **AWS-DEPLOYMENT-GUIDE.md** - Detailed infrastructure steps
- **DOCKER-K8S-DEPLOYMENT.sh** - Container deployment script
- **MONITORING-SLACK-SETUP.sh** - Monitoring configuration
- **END-TO-END-TEST.md** - Complete testing procedure
- **PROJECT-STATUS-PHASE-3.md** - Project overview and status

## 🚨 Troubleshooting

### CloudFormation stack fails
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name autonomous-orchestrator-eks --region eu-central-1

# View detailed error
aws cloudformation describe-stacks --stack-name autonomous-orchestrator-eks --region eu-central-1
```

### Pod not running
```bash
# Get pod details
kubectl describe pod <pod-name> -n default

# Check pod events
kubectl get events -n default

# View pod logs
kubectl logs <pod-name> -n default
```

### Docker image push fails
```bash
# Verify ECR login
aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.eu-central-1.amazonaws.com

# Check ECR repository
aws ecr describe-repositories --region eu-central-1
```

## 🔐 Security Checklist

After deployment, verify:
- [ ] Change Grafana default password
- [ ] Rotate AWS IAM credentials
- [ ] Configure network policies
- [ ] Enable encryption for EBS volumes
- [ ] Setup CloudTrail logging
- [ ] Configure backup strategy
- [ ] Update Slack webhook security
- [ ] Enable pod security policies

## 📞 Support

For issues or questions:
1. Check **END-TO-END-TEST.md** troubleshooting section
2. Review **PROJECT-STATUS-PHASE-3.md** for known issues
3. Check CloudFormation events for AWS-related errors
4. View Kubernetes events: `kubectl get events -n default`
5. Check orchestrator logs: `kubectl logs deployment/autonomous-orchestrator -n default`

## 📈 Performance Targets

- **Deployment Time:** 60 minutes total
- **Pod Startup:** < 2 minutes
- **Metric Collection:** < 30 seconds
- **Alert Delivery:** < 1 minute
- **Automation Latency:** < 5 seconds (GitHub → Jira)

## 🎓 Architecture

```
┌─────────────┐
│   GitHub    │
│  Commits    │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Zapier    │
│ Automation  │
└──┬────┬────┬┘
   │    │    │
   v    v    v
┌──┐ ┌──┐ ┌──┐
│JI│ │NO│ │CL│ (Jira, Notion, ClickUp)
│RA│ │TI│ │IC│
└──┘ └──┘ └──┘
   │    │    │
   └────┬────┘
        v
   ┌─────────┐
   │ Kubernetes
   │   EKS    │
   └────┬────┘
        v
   ┌─────────────┐
   │ Orchestrator│
   │   Agent     │
   └────┬────────┘
        v
   ┌─────────────┐
   │ Prometheus  │
   │  Grafana    │
   └────┬────────┘
        v
   ┌─────────────┐
   │    Slack    │
   │  Alerts     │
   └─────────────┘
```

## 📅 Next Steps

1. Execute deployment scripts in sequence
2. Verify all components are running
3. Execute end-to-end test
4. Configure production settings (passwords, webhooks)
5. Setup automated backups
6. Configure monitoring alerts
7. Document runbooks for operations team
8. Plan for Phases 4-9 enhancements

---

**Created:** December 7, 2025
**Status:** Production Ready
**Repository:** https://github.com/romanchaa997/civic-digital-infrastructure-platform
