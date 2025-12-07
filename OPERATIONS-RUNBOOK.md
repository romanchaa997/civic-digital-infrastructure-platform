# Operations Runbook - Autonomous Orchestration Platform

## Daily Operations Checklist

### Morning (8 AM)

```bash
# Check cluster health
kubectl get nodes
kubectl get pods --all-namespaces

# Check Prometheus metrics
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090 &
# Visit http://localhost:9090/graph?g0.expr=up

# Verify Grafana dashboards
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80 &
# Visit http://localhost:3000 (admin/ChangeMeToSecure123!)

# Check recent alerts
kubectl get alerts -n monitoring
```

### Monitor Automation Execution

```bash
# Watch orchestrator logs
kubectl logs -f deployment/autonomous-orchestrator -n default

# Check recent pod events
kubectl get events -n default --sort-by='.lastTimestamp'

# Monitor Zapier executions
# Visit zapier.com dashboard for Zap execution history
```

## Emergency Procedures

### Pod Crash Recovery

```bash
# 1. Check pod status
kubectl describe pod <pod-name> -n default

# 2. View logs
kubectl logs <pod-name> -n default

# 3. Force pod restart
kubectl rollout restart deployment/autonomous-orchestrator -n default

# 4. Wait for rollout
kubectl rollout status deployment/autonomous-orchestrator -n default
```

### Storage Issues

```bash
# Check persistent volume status
kubectl get pv
kubectl get pvc --all-namespaces

# Check disk usage
kubectl exec -it <pod-name> -- df -h

# Resize PVC if needed
# Edit the PVC: kubectl edit pvc <pvc-name> -n <namespace>
```

### Network Issues

```bash
# Test connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
# Then: ping 8.8.8.8, nslookup api.github.com

# Check service connectivity
kubectl get svc --all-namespaces
kubectl describe svc <service-name> -n <namespace>
```

## Scaling Operations

### Increase Replicas

```bash
# Scale orchestrator
kubectl scale deployment/autonomous-orchestrator --replicas=3 -n default

# Verify scaling
kubectl get deployment -n default
kubectl get pods -n default -l app=autonomous-orchestrator
```

### Increase Node Count

```bash
# Scale node group
aws eks update-nodegroup-config --cluster-name autonomous-orchestrator-eks \
  --nodegroup-name <nodegroup-name> \
  --scaling-config minSize=3,maxSize=10,desiredSize=5 \
  --region eu-central-1
```

## Backup and Disaster Recovery

### Daily Backup

```bash
# Backup Prometheus data
kubectl exec -it <prometheus-pod> -n monitoring -- tar czf /tmp/prometheus-backup.tar.gz /prometheus

# Copy to S3
aws s3 cp s3://backup-bucket/prometheus-backup.tar.gz /tmp/

# Backup Grafana config
kubectl get grafana-dashboards -n monitoring -o yaml > grafana-dashboards-backup.yaml
```

### Restore from Backup

```bash
# Restore Prometheus data
kubectl cp prometheus-backup.tar.gz <pod-name>:/tmp/ -n monitoring
kubectl exec <pod-name> -n monitoring -- tar xzf /tmp/prometheus-backup.tar.gz
```

## Security Operations

### Update Passwords

```bash
# Grafana password
kubectl exec -it <grafana-pod> -n monitoring -- \
  grafana-cli admin reset-admin-password <new-password>

# Change Slack webhook
kubectl edit secret alertmanager-config -n monitoring
```

### Audit Logging

```bash
# Check CloudTrail logs
aws cloudtrail lookup-events --region eu-central-1 --max-items 10

# View Kubernetes audit logs
kubectl logs -n kube-system -l component=audit
```

## Performance Optimization

### Analyze Metrics

```bash
# CPU Usage
kubectl top pods -n default
kubectl top nodes

# Memory Usage
kubectl describe node <node-name>

# Query Prometheus
# CPU: container_cpu_usage_seconds_total
# Memory: container_memory_usage_bytes
```

### Optimize Resources

```bash
# Check resource requests/limits
kubectl get pods -o json | jq '.items[] | {name: .metadata.name, resources: .spec.containers[].resources}'

# Update resource limits
kubectl set resources deployment/autonomous-orchestrator \
  --limits=cpu=2000m,memory=2Gi \
  --requests=cpu=500m,memory=512Mi -n default
```

## Alert Management

### Handle Critical Alerts

```bash
# 1. Check alert details
kubectl get prometheus -n monitoring -o yaml

# 2. Acknowledge in AlertManager
# Visit http://localhost:9093

# 3. Update routing if needed
kubectl edit configmap alertmanager-config -n monitoring
```

### Silence Alerts

```bash
# Create silence in AlertManager
kubectl exec -it <alertmanager-pod> -n monitoring -- amtool silence add \
  alertname=~PodCrashLooping \
  duration=24h
```

## Troubleshooting Guide

### Pod Won't Start

1. Check logs: `kubectl logs <pod-name>`
2. Check events: `kubectl describe pod <pod-name>`
3. Check resources: `kubectl top nodes`
4. Check image: `kubectl describe pod <pod-name> | grep Image`

### High CPU Usage

1. Identify hot pod: `kubectl top pods -n default`
2. Check logs for loops: `kubectl logs <pod-name> | tail -100`
3. Scale replicas: `kubectl scale deployment <name> --replicas=3`
4. Profile with Prometheus

### Storage Full

1. Check disk: `kubectl exec <pod> -- df -h`
2. Check PVC: `kubectl get pvc -n default`
3. Cleanup old data
4. Resize PVC

### Network Timeout

1. Test DNS: `kubectl run -it --rm debug --image=busybox -- nslookup github.com`
2. Test connectivity: `kubectl exec <pod> -- curl -v https://api.github.com`
3. Check firewall rules
4. Check service endpoints: `kubectl get endpoints`

## Maintenance Windows

### Weekly Maintenance (Sunday 2 AM)

- Backup all data to S3
- Run cluster updates: `kubectl get nodes`
- Clear logs older than 30 days
- Verify backup integrity
- Update SSL certificates if needed

### Monthly Maintenance (1st of month)

- Review security policies
- Update container images
- Review and optimize costs
- Audit IAM permissions
- Test disaster recovery

## Contact & Escalation

**On-Call Engineer:** Check Slack #devops-on-call

**Critical Issues:**
1. Notify team in Slack
2. Page on-call engineer
3. Start incident tracking
4. Begin mitigation
5. Post-mortem after resolution

## Additional Resources

- Kubernetes Docs: https://kubernetes.io/docs/
- AWS EKS: https://docs.aws.amazon.com/eks/
- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/
