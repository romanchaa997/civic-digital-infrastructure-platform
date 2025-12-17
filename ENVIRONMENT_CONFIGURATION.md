# Environment Configuration Guide

## Staging & Production Environment Setup

Comprehensive guide for configuring staging and production environments for the Civic Digital Infrastructure Platform.

### Environment Overview

| Environment | Purpose | Cluster | Replicas | Auto-scaling |
|-------------|---------|---------|----------|---------------|
| **Development** | Local testing | minikube | 1 | Disabled |
| **Staging** | Pre-production testing | EKS staging | 2 | Enabled (2-5) |
| **Production** | Live deployment | EKS prod | 3+ | Enabled (3-10) |

### Environment Variables Configuration

#### Staging Environment

```bash
# .env.staging
NODE_ENV=staging
LOG_LEVEL=info
DATABASE_URL=postgresql://user:pass@staging-db:5432/civic_staging
REDIS_URL=redis://staging-redis:6379
KUBERNETES_NAMESPACE=civic-platform-staging
CONTAINER_REGISTRY=staging-registry.example.com
REPLICAS=2
CPU_REQUEST=250m
MEMORY_REQUEST=512Mi
CPU_LIMIT=500m
MEMORY_LIMIT=1Gi
```

#### Production Environment

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
DATABASE_URL=postgresql://user:pass@prod-db.rds.amazonaws.com:5432/civic_production
REDIS_URL=redis://prod-redis.elasticache.amazonaws.com:6379
KUBERNETES_NAMESPACE=civic-platform
CONTAINER_REGISTRY=prod-registry.example.com
REPLICAS=3
CPU_REQUEST=500m
MEMORY_REQUEST=1Gi
CPU_LIMIT=1000m
MEMORY_LIMIT=2Gi
HPA_MIN_REPLICAS=3
HPA_MAX_REPLICAS=10
HPA_TARGET_CPU=70
HPA_TARGET_MEMORY=80
```

### Kubernetes Secrets Management

#### Production Secrets Structure

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: civic-platform-secrets
  namespace: civic-platform
type: Opaque
stringData:
  DATABASE_PASSWORD: "<secure-password>"
  REDIS_PASSWORD: "<secure-password>"
  API_KEY: "<api-key>"
  WEBHOOK_SECRET: "<webhook-secret>"
  JWT_SECRET: "<jwt-secret>"
  ENCRYPTION_KEY: "<encryption-key>"
```

### Database Configuration

#### Staging Database (AWS RDS)

- **Instance Type**: db.t3.small
- **Storage**: 20GB SSD
- **Backup Retention**: 7 days
- **Multi-AZ**: Disabled
- **Engine**: PostgreSQL 14+

#### Production Database (AWS RDS)

- **Instance Type**: db.r5.xlarge
- **Storage**: 500GB SSD with auto-scaling
- **Backup Retention**: 30 days
- **Multi-AZ**: Enabled (automatic failover)
- **Engine**: PostgreSQL 14+
- **Enhanced Monitoring**: Enabled
- **Performance Insights**: Enabled

### Cache Configuration

#### Staging Redis (ElastiCache)

- **Node Type**: cache.t3.micro
- **Engine**: Redis 7.0
- **Replication**: Single node
- **Automatic Failover**: Disabled

#### Production Redis (ElastiCache)

- **Node Type**: cache.r6g.xlarge
- **Engine**: Redis 7.0
- **Replication**: Multi-node cluster (3 nodes)
- **Automatic Failover**: Enabled
- **Encryption**: At-rest and in-transit

### Load Balancer Configuration

#### AWS Application Load Balancer (ALB)

```yaml
# Production ALB Configuration
Type: AWS::ElasticLoadBalancingV2::LoadBalancer
Properties:
  Name: civic-platform-alb
  Subnets:
    - subnet-prod-1a
    - subnet-prod-1b
    - subnet-prod-1c
  SecurityGroups:
    - sg-alb-prod
  Scheme: internet-facing
  IpAddressType: ipv4
  Tags:
    - Key: Environment
      Value: production
```

### Network Configuration

#### VPC Setup

```yaml
VPC CIDR: 10.0.0.0/16

Public Subnets:
  - 10.0.1.0/24 (AZ-1a)
  - 10.0.2.0/24 (AZ-1b)
  - 10.0.3.0/24 (AZ-1c)

Private Subnets:
  - 10.0.11.0/24 (AZ-1a) - EKS nodes
  - 10.0.12.0/24 (AZ-1b) - EKS nodes
  - 10.0.13.0/24 (AZ-1c) - EKS nodes

Database Subnets:
  - 10.0.21.0/24 (AZ-1a) - RDS
  - 10.0.22.0/24 (AZ-1b) - RDS
  - 10.0.23.0/24 (AZ-1c) - RDS
```

### SSL/TLS Configuration

#### Certificate Management (AWS ACM)

- **Domain**: api.civic-platform.gov
- **Issuer**: AWS Certificate Manager (ACM)
- **Renewal**: Automatic
- **Validation**: DNS CNAME
- **Alternative Names**:
  - *.civic-platform.gov
  - staging.civic-platform.gov

### Monitoring & Logging

#### CloudWatch Configuration

```yaml
Log Groups:
  - /aws/eks/civic-platform/application
  - /aws/eks/civic-platform/system
  - /aws/rds/civic-platform/error
  - /aws/rds/civic-platform/slowquery

Metrics:
  - CPU Utilization
  - Memory Usage
  - Network I/O
  - Database Connections
  - Cache Hit Ratio
  - API Response Time

Alarms:
  - High CPU (>80%) - 5 min average
  - High Memory (>85%) - 5 min average
  - Database Connection Pool Exhausted
  - Cache Eviction Rate High
  - API Error Rate >1%
```

### Backup & Disaster Recovery

#### Backup Strategy

**Database Backups:**
- Automated daily snapshots (RDS)
- Point-in-time recovery (35 days retention)
- Cross-region replication (production only)

**Application State:**
- Kubernetes etcd backup (hourly)
- Persistent volume snapshots (daily)
- Configuration backups to S3 (versioned)

#### Disaster Recovery RTO/RPO

| Component | RTO | RPO | Location |
|-----------|-----|-----|----------|
| Database | 1 hour | 15 min | Multi-AZ RDS |
| Cache | 30 min | 0 min | Rebuilt from source |
| Application | 15 min | 5 min | EKS auto-recovery |
| S3 Objects | 4 hours | 1 hour | Cross-region replication |

### Deployment Workflow

#### Staging Deployment Process

1. Feature branch pushes trigger staging deployment
2. Run integration tests in staging namespace
3. Run smoke tests against staging APIs
4. Generate performance baseline report
5. Slack notification with results

#### Production Deployment Process

1. Create release tag (v*.*.*)  
2. Trigger production build pipeline
3. Run security scanning
4. Manual approval required
5. Blue-green deployment (staging phase)
6. Smoke tests validation
7. Traffic switch (5% -> 25% -> 50% -> 100%)
8. Monitor metrics for 30 minutes
9. Automatic rollback if metrics exceed thresholds

### Access Control

#### RBAC Configuration

```yaml
# Production Access Tiers

Administrators:
  - Full cluster access
  - Kubernetes RBAC admin
  - AWS IAM root

DevOps Engineers:
  - Deployment permissions
  - Logs and monitoring access
  - Secret management
  - Kubernetes admin in civic-platform namespace

Developers:
  - Read-only logs
  - Pod debugging (exec)
  - View metrics
  - Kubernetes viewer in civic-platform namespace

Security Team:
  - Audit logs access
  - Policy enforcement review
  - Security scanning results
```

### Performance Tuning

#### Database Optimization

```sql
-- Connection pooling
max_connections = 1000
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

#### Kubernetes Resource Limits

```yaml
# Production pod resources
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 1000m
    memory: 2Gi

# HPA configuration
hpa:
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
  scaleDownBehavior:
    stabilizationWindowSeconds: 300
```

### Compliance & Security

#### Required Certifications

- GDPR compliance enabled
- HIPAA ready (if applicable)
- SOC 2 Type II certification in progress
- Data encryption at-rest and in-transit

#### Security Scanning

- Weekly vulnerability scans (Trivy)
- OWASP Top 10 compliance checks
- Dependency scanning (Snyk)
- Container image scanning (ECR scanning)
- Network policy enforcement

### Troubleshooting

#### Common Issues

**High Latency:**
- Check database connection pool
- Review CloudWatch metrics
- Verify cache hit ratio
- Check network bandwidth

**Pod Crashes:**
- Review pod logs
- Check resource limits
- Verify secrets/configmaps
- Check node resources

**Database Connection Errors:**
- Verify security groups
- Check RDS instance status
- Review connection string
- Check credentials in secrets

### Next Steps

1. Deploy staging environment
2. Configure auto-scaling policies
3. Set up CloudWatch dashboards
4. Configure SNS alerts
5. Test disaster recovery procedures
6. Deploy production environment
7. Set up cross-region replication
