# Civic Digital Infrastructure Platform - CI/CD Workflows

Comprehensive documentation for all GitHub Actions workflows in this repository.

## Table of Contents

1. [Overview](#overview)
2. [Workflow Dependency Chain](#workflow-dependency-chain)
3. [Individual Workflows](#individual-workflows)
4. [Secrets Configuration](#secrets-configuration)
5. [Kubernetes Deployment Details](#kubernetes-deployment-details)
6. [Troubleshooting](#troubleshooting)

## Overview

This repository uses GitHub Actions for continuous integration, code quality checks, security scanning, and deployment to Kubernetes. The workflows are designed to ensure code quality, security, and reliability before deployment.

### Current Workflows

- **Code Quality Checks** (`code-quality.yml`) - Linting, formatting, and quality analysis
- **Security Scanning** (`security-scanning.yml`) - SAST, dependency scanning, OWASP checks
- **CodeQL Analysis** (`codeql.yml`) - Advanced semantic code analysis
- **CI/CD Pipeline** (`ci-cd.yml`) - Build and test pipeline
- **Kubernetes Deployment** (`k8s-deployment.yml`) - Multi-phase Kubernetes deployment

## Workflow Dependency Chain

The workflows follow this dependency chain:

```
┌─────────────────────────────┐
│   Push to main / Tag v*.*   │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       │                │
  ┌────▼─────────┐  ┌──▼─────────────┐
  │  Code Quality│  │Security Scanning
  │   Checks     │  │  (OWASP, Snyk)  
  └────┬─────────┘  └──┬──────────────┘
       │                │
       └────────┬───────┘
                │
       ┌────────▼────────┐
       │ Kubernetes      │
       │ Deployment      │
       │ (Phase 1 & 2)   │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │ Smoke Tests     │
       │ & Verification  │
       └─────────────────┘
```

## Individual Workflows

### 1. Code Quality Checks (`code-quality.yml`)

**Trigger:** On every push to any branch

**Purpose:** Ensures code meets quality standards

**Steps:**
- ESLint for TypeScript/JavaScript files
- Python linting (flake8, pylint)
- YAML validation
- Docker image build validation

**Status Check:** Must pass before deploying to production

### 2. Security Scanning (`security-scanning.yml`)

**Trigger:** On push to main and scheduled daily

**Purpose:** Identifies security vulnerabilities

**Tools Used:**
- OWASP Dependency Check
- Snyk (if configured)
- Container scanning
- Secret scanning

**Status Check:** Must pass before production deployment

### 3. CodeQL Analysis (`codeql.yml`)

**Trigger:** On push to main branch

**Purpose:** Advanced semantic code analysis

**Languages Analyzed:**
- Python
- TypeScript/JavaScript
- Java (if applicable)

### 4. CI/CD Pipeline (`ci-cd.yml`)

**Trigger:** On push and pull requests

**Purpose:** Build and test the application

**Steps:**
- Setup Python environment
- Install dependencies
- Run unit tests
- Generate coverage reports
- Build Docker images

### 5. Kubernetes Deployment (`k8s-deployment.yml`) - **NEW**

**Trigger:**
- Push to main branch
- Git tags matching `v*.*.*` pattern
- Completion of Code Quality Checks and Security Scanning workflows

**Purpose:** Deploy application to Kubernetes cluster with multi-phase rollout

**Features:**
- Automated Docker image build and push
- Multi-phase deployment (Microservices → Advanced Features)
- Smoke tests between phases
- Automatic rollback on failure
- Slack notifications

**Deployment Phases:**

#### Phase 1: Microservices Deployment
- Create namespace: `civic-platform`
- Apply ConfigMaps and Secrets
- Deploy core microservices
- Deploy services and networking
- Wait for rollout (5-minute timeout)

#### Smoke Tests
- Run integration tests in cluster
- Verify service connectivity
- Test API endpoints
- Validate data processing pipeline

#### Phase 2: Advanced Features
- Deploy Ingress controllers
- Enable auto-scaling (HPA)
- Deploy monitoring stack
- Deploy stateful components

**Kubernetes Manifests Location:** `k8s/phase1/` and `k8s/phase2/`

## Secrets Configuration

The following secrets must be configured in GitHub for the Kubernetes deployment workflow:

### Required Secrets

```
DOCKER_REGISTRY_URL         - Docker registry URL (e.g., registry.example.com)
DOCKER_REGISTRY_USERNAME    - Registry username
DOCKER_REGISTRY_PASSWORD    - Registry password/token
KUBE_CONFIG                 - Base64-encoded kubeconfig file
SLACK_WEBHOOK_URL          - Slack webhook for notifications
```

### Setting Up Secrets

1. Navigate to Repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with the exact names above

**For KUBE_CONFIG:**
```bash
# Encode your kubeconfig file
cat ~/.kube/config | base64 -w 0 | xclip -selection clipboard
# Then paste into GitHub Secrets
```

## Kubernetes Deployment Details

### Directory Structure

```
k8s/
├── phase1/
│   ├── namespaces.yml
│   ├── configmaps.yml
│   ├── secrets.yml
│   ├── deployments.yml
│   └── services.yml
└── phase2/
    ├── ingress.yml
    ├── autoscaling.yml
    └── monitoring.yml
```

### Deployment Process

1. **Version Detection**
   - Tags: Extract version from git tag (e.g., v1.2.3)
   - Main branch: Use short commit SHA

2. **Docker Image Building**
   - Build from Dockerfile
   - Tag with version
   - Push to registry
   - Uses GitHub Actions cache for layers

3. **Cluster Configuration**
   - Decode kubeconfig from base64
   - Configure kubectl
   - Set proper file permissions

4. **Phase 1 Deployment**
   - Apply all Phase 1 manifests
   - Wait for deployment readiness
   - Execute smoke tests
   - On failure: trigger automatic rollback

5. **Phase 2 Deployment** (if Phase 1 succeeds)
   - Apply ingress configuration
   - Configure autoscaling policies
   - Deploy monitoring stack

6. **Verification**
   - List all pods in namespace
   - Describe deployment status
   - Stream recent logs

### Automatic Rollback

If deployment fails:
1. Kubernetes rollback job triggers automatically
2. Reverts to previous stable deployment
3. Sends Slack notification
4. Updates GitHub deployment status

## Troubleshooting

### Workflow Fails: "Account is locked due to billing issue"

**Cause:** GitHub account billing problem

**Solution:**
1. Update payment method in GitHub Settings → Billing
2. Contact GitHub Support if issue persists
3. Re-run failed workflow after resolution

### Kubernetes Deployment Fails

**Check logs:**
```bash
# View workflow logs in GitHub Actions tab
# Check specific error in job output
```

**Common Issues:**

1. **"kubeconfig not found"**
   - Verify KUBE_CONFIG secret is set
   - Ensure base64 encoding is correct
   - Test decoding locally

2. **"Image pull errors"**
   - Verify Docker registry credentials
   - Check image tag format
   - Ensure registry is accessible from cluster

3. **"Pod pending/CrashLoopBackOff"**
   - Check resource requests/limits
   - Verify ConfigMaps and Secrets exist
   - Review pod logs: `kubectl logs <pod-name>`

4. **"Timeout waiting for rollout"**
   - Increase timeout in workflow (default: 5 min)
   - Check cluster resource availability
   - Verify image pulling successfully

### Re-running Workflows

1. Navigate to Actions tab
2. Click on failed workflow
3. Click "Re-run all jobs"

Or trigger manually:
```bash
# Create a new commit
git commit --allow-empty -m "Trigger workflows"
git push
```

## Performance Optimization

### Docker Layer Caching
- Workflows use GitHub Actions cache
- Cached layers are reused across runs
- Reduces build time by 50-70%

### Parallel Execution
- Code Quality and Security Scanning run in parallel
- Both must complete before deployment
- Total time: ~15 minutes (end-to-end)

## Monitoring & Alerts

### Slack Notifications

Deploy workflow sends notifications on:
- Deployment start
- Deployment success/failure
- Automatic rollback triggers

**Notification Format:**
```
Kubernetes Deployment v1.2.3 - ✅ SUCCESS
Run: https://github.com/.../actions/runs/12345
Author: romanchaa997
Branch: main
Commit: abc1234
```

### Manual Status Check

```bash
# Check deployment status
kubectl rollout status deployment/civic-platform -n civic-platform

# View pod status
kubectl get pods -n civic-platform

# Check recent events
kubectl get events -n civic-platform --sort-by='.lastTimestamp'
```

## Next Steps

1. ✅ Create k8s manifests in `k8s/phase1/` and `k8s/phase2/`
2. ✅ Configure GitHub Secrets with cluster credentials
3. ⏳ Test deployment in staging environment
4. ⏳ Configure Slack webhook for notifications
5. ⏳ Set up branch protection rules requiring workflow success

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Deployment Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
