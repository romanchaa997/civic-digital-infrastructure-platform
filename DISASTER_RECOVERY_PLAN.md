# Disaster Recovery Plan

## Executive Summary

This document outlines the comprehensive Disaster Recovery (DR) procedures for the Civic Digital Infrastructure Platform, ensuring rapid recovery with minimal data loss and system downtime.

**Key Metrics:**
- **RTO (Recovery Time Objective)**: 4 hours maximum
- **RPO (Recovery Point Objective)**: 1 hour maximum
- **Backup Frequency**: Every 15 minutes (transaction logs)
- **Test Schedule**: Monthly full DR tests

## Disaster Classification

### Tier 1: Critical (Immediate Action Required)
- **Total infrastructure failure**
- **Region/Availability Zone outage**
- **Database complete corruption**
- **Ransomware/Data breach incident**
- **Recovery Time**: 15 minutes to 4 hours

### Tier 2: Major (Urgent Action)
- **Application service failure**
- **Partial data loss**
- **Network connectivity issues**
- **Performance degradation >50%**
- **Recovery Time**: 1-8 hours

### Tier 3: Minor (Standard Procedures)
- **Single pod/container crash**
- **Non-critical service degradation**
- **Minor data inconsistencies**
- **Recovery Time**: 15 minutes to 1 hour

## Backup Strategy

### Database Backup (PostgreSQL on RDS)

**Automated Backups:**
```yaml
Automated Backups:
  Frequency: Daily (automated snapshots)
  Retention Period: 35 days
  Timing: 02:00 UTC daily
  Location: AWS S3 (multi-region)
  Backup Window: 1-2 hours

Transaction Logs:
  Frequency: Every 15 minutes
  Retention: 7 days
  Archive Location: S3 + Glacier
  Enable: Binary logging, WAL archiving
```

**Manual Backups (On-Demand):**
```bash
# Create manual RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier civic-platform-prod \
  --db-snapshot-identifier civic-snapshot-$(date +%Y%m%d-%H%M%S)

# Create PostgreSQL dump
pg_dump -h prod-db.rds.amazonaws.com \
  -U postgres -d civic_production | \
  gzip > civic-backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

### Kubernetes State Backup

**etcd Backup:**
```bash
# Backup etcd database (run on master nodes)
ETCDCTL_API=3 etcdctl snapshot save \
  /backup/etcd-snapshot-$(date +%s).db

# Verify snapshot
ETCDCTL_API=3 etcdctl snapshot status \
  /backup/etcd-snapshot-*.db
```

**Persistent Volumes:**
```yaml
Persistent Volume Backups:
  Frequency: Daily
  Snapshot Tool: AWS EBS snapshots
  Retention: 30 days
  Cross-Region: Enabled
  Encryption: AES-256 at-rest
```

### Application Code & Configuration

**Version Control:**
- Git repository: GitHub (main source)
- Backup: GitHub Enterprise backup service
- Frequency: Continuous (all commits backed up)
- Retention: Indefinite (GitHub retention policy)

**Configuration Management:**
```bash
# Backup all Kubernetes ConfigMaps
kubectl get configmaps -n civic-platform -o yaml > \
  configmaps-backup-$(date +%Y%m%d-%H%M%S).yaml

# Backup all Secrets
kubectl get secrets -n civic-platform -o yaml > \
  secrets-backup-$(date +%Y%m%d-%H%M%S).yaml.gpg  # encrypted

# Backup to S3
aws s3 cp configmaps-backup-*.yaml \
  s3://civic-platform-backup-prod/kubernetes/
```

## Recovery Procedures

### Database Recovery (Tier 1)

**Step 1: Assess Damage**
```bash
# Check database status
aws rds describe-db-instances \
  --db-instance-identifier civic-platform-prod

# Verify latest backup
aws rds describe-db-snapshots \
  --db-instance-identifier civic-platform-prod \
  --query 'DBSnapshots[0].[DBSnapshotIdentifier,SnapshotCreateTime]'
```

**Step 2: Restore from Snapshot**
```bash
# Create new instance from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier civic-platform-restored \
  --db-snapshot-identifier <snapshot-id> \
  --db-instance-class db.r5.xlarge \
  --publicly-accessible false \
  --multi-az

# Wait for restoration (typically 5-15 minutes)
aws rds wait db-instance-available \
  --db-instances civic-platform-restored
```

**Step 3: Verify Data Integrity**
```bash
# Connect to restored database
psql -h civic-platform-restored.xxx.rds.amazonaws.com \
  -U postgres -d civic_production

# Run integrity checks
SELECT datname, pg_database.datdba FROM pg_database;
VACUUM ANALYZE;
```

**Step 4: Update Application Connection**
```bash
# Update Kubernetes secrets with new endpoint
kubectl edit secret civic-platform-secrets \
  -n civic-platform

# Verify deployment update
kubectl rollout restart deployment/civic-platform \
  -n civic-platform
kubectl rollout status deployment/civic-platform \
  -n civic-platform
```

### Kubernetes Cluster Recovery (Tier 1)

**Step 1: Assess Cluster Health**
```bash
# Check cluster status
kubectl cluster-info
kubectl get nodes
kubectl get all -n civic-platform

# Check for pod failures
kubectl get pods -n civic-platform --field-selector=status.phase!=Running
```

**Step 2: Restore etcd (if corrupted)**
```bash
# Stop API server on affected node
sudo systemctl stop kubelet

# Restore from backup
ETCDCTL_API=3 etcdctl snapshot restore \
  /backup/etcd-snapshot-<timestamp>.db \
  --data-dir=/var/lib/etcd-restored

# Start kubelet
sudo systemctl start kubelet
```

**Step 3: Restore Persistent Volumes**
```bash
# List available snapshots
aws ec2 describe-snapshots \
  --filters "Name=volume-id,Values=vol-xxx" \
  --query 'Snapshots[*].[SnapshotId,StartTime]'

# Create volume from snapshot
aws ec2 create-volume \
  --snapshot-id snap-xxx \
  --availability-zone us-east-1a

# Attach and mount
kubectl patch pv <pv-name> -p \
  '{"spec":{"awsElasticBlockStore":{"volumeID":"vol-xxx"}}}'
```

### Application Recovery (Tier 2)

**Step 1: Restart Failed Services**
```bash
# Scale down to 0
kubectl scale deployment civic-platform \
  --replicas=0 -n civic-platform

# Clear pod cache
kubectl delete pods --all -n civic-platform

# Scale back up
kubectl scale deployment civic-platform \
  --replicas=3 -n civic-platform
```

**Step 2: Verify Health Checks**
```bash
# Check application readiness
kubectl get pods -n civic-platform \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[*].status}{"\n"}{end}'

# Test endpoint health
curl -i https://api.civic-platform.gov/health
echo $?
```

**Step 3: Gradual Traffic Restoration**
```bash
# Check current traffic split (if using Istio/Flagger)
kubectl get vs civic-platform-vs -n civic-platform

# Manual traffic shift (5% -> 25% -> 50% -> 100%)
kubectl patch vs civic-platform-vs --type merge -p \
  '{"spec":{"hosts":[{"name":"api.civic-platform.gov","http":[{"match":[],"route":[{"destination":{"host":"civic-platform","port":{"number":8080}},"weight":5}]}]}]}}'
```

## Communication Plan

### During Disaster

**T+0 (Discovery)**
- Alert severity determined
- Incident commander assigned
- War room opened (Slack channel: #incident-response)
- Status page updated: INVESTIGATING

**T+15 (Assessment)**
- Initial cause identified
- Recovery steps initiated
- Stakeholders notified
- Status: INVESTIGATING → MAJOR INCIDENT

**T+1h (Update)**
- Progress update to stakeholders
- ETA provided
- Status page: IN PROGRESS
- External communications (if necessary)

### After Recovery

**T+Recovery Complete**
- Services verified operational
- All monitoring green
- Status page: RESOLVED
- Post-mortem scheduled

## Testing & Validation

### Monthly DR Drill

**Schedule:** First Saturday of every month, 14:00-16:00 UTC

**Test Scenarios:**
1. **Month 1**: Database recovery from snapshot
2. **Month 2**: Kubernetes cluster rebuild
3. **Month 3**: Full infrastructure failover
4. **Month 4**: Multi-region recovery

**Validation Checklist:**
```
✓ Backup integrity verified
✓ Recovery time < RTO
✓ Data loss < RPO
✓ All services operational
✓ Data consistency verified
✓ Monitoring re-enabled
✓ Documentation updated
```

### Quarterly Full Test

**Schedule:** End of Q1, Q2, Q3, Q4
**Duration**: 4-6 hours
**Scope**: Complete infrastructure failover to DR region
**Success Criteria**: Zero data loss, RTO < 4 hours

## Contact & Escalation

### Incident Commander (On-Call)

**Tier 1 (Primary):**
- Name: DevOps Lead
- Phone: +1-XXX-XXX-XXXX
- Email: oncall@civic-platform.gov

**Tier 2 (Secondary):**
- Name: Infrastructure Engineer
- Phone: +1-XXX-XXX-XXXX
- Email: infra-team@civic-platform.gov

**Escalation:**
- If Tier 1 unavailable: Page Tier 2
- If both unavailable: Call CTO directly
- After 2h without progress: Executive escalation

## Post-Recovery Actions

**Immediate (First 24 Hours):**
- [ ] All systems operational
- [ ] All data verified
- [ ] Monitoring/alerting active
- [ ] Incident timeline documented

**Short-term (1 Week):**
- [ ] Root cause analysis completed
- [ ] Post-mortem meeting held
- [ ] Action items assigned
- [ ] Preventive measures implemented

**Long-term (30 Days):**
- [ ] All action items closed
- [ ] Runbooks updated
- [ ] Team training completed
- [ ] DR test scheduled

## Appendix: Critical Contact Information

| Role | Name | Phone | Email |
|------|------|-------|-------|
| CTO | John Doe | +1-XXX-1111 | cto@civic-platform.gov |
| DevOps Lead | Jane Smith | +1-XXX-2222 | devops@civic-platform.gov |
| Database Admin | Bob Johnson | +1-XXX-3333 | dba@civic-platform.gov |
| Security Lead | Alice Brown | +1-XXX-4444 | security@civic-platform.gov |
| AWS TAM | AWS Support | 1-844-AWS-SUPP | https://console.aws.amazon.com/support |

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|----------|
| 1.0 | 2024-01-15 | DevOps | Initial version |
| 1.1 | 2024-02-20 | DevOps | Added Tier 2/3 procedures |
| 1.2 | 2024-03-10 | Security | Security considerations added |

---

**Last Updated**: December 2024
**Next Review**: June 2025
**Classification**: Internal Use Only
