# End-to-End Automation Test Guide

## Phase 3: Production Verification & Full Pipeline Testing

### Pre-Test Checklist

- [ ] EKS cluster deployed and running
- [ ] kubectl configured and accessible
- [ ] Docker image built and pushed to ECR
- [ ] Orchestrator pods deployed to Kubernetes (Running status)
- [ ] Prometheus monitoring operational
- [ ] Grafana dashboards accessible
- [ ] Slack webhooks configured
- [ ] Zapier automations published and active

### Test Flow Overview

```
GitHub Commit
    |
    v
Zapier Webhook
    |
    +---> Jira Issue Creation
    |
    +---> Notion Database Update
    |
    +---> ClickUp Task Creation
    |
    v
K8s Orchestrator Pod
    |
    v
Prometheus Metrics Collection
    |
    v
Grafana Dashboard Update
    |
    v
Slack Notification
```

### Step 1: Create Test Commit

```bash
# Create a test branch
git checkout -b test/automation-e2e

# Create a test file
echo "# Test Commit $(date +%s)" > test-automation.txt
echo "This commit triggers the full automation pipeline." >> test-automation.txt

# Stage and commit
git add test-automation.txt
git commit -m "Test: Trigger complete automation pipeline"

# Push to trigger Zapier webhook
git push origin test/automation-e2e
```

### Step 2: Monitor Zapier Execution

```bash
# View Zapier execution history
# 1. Go to https://zapier.com
# 2. Navigate to your published Zaps
# 3. Check "Zap #1: GitHub Commit Trigger"
# 4. Look for recent executions
# 5. Verify success status
```

### Step 3: Verify Jira Issue Creation

```bash
# Check Jira for new issue
# Expected:
# - Issue Type: Bug or Story (based on configuration)
# - Summary: From commit message
# - Description: From commit details
# - Status: To Do or Open

# JQL Query to find test issue:
# text ~ "Test: Trigger complete automation" OR created > now-5m
```

### Step 4: Verify Notion Database Update

```bash
# Open Notion database
# Look for new entry with:
# - Title: From commit message
# - Repository: civic-digital-infrastructure-platform
# - Type: GitHub Commit
# - Linked Jira Issue: Should reference newly created issue
# - Status: Processing or Complete
```

### Step 5: Verify ClickUp Task Creation

```bash
# Open ClickUp workspace
# Check project board for new task:
# - Title: From commit message
# - Description: Automation test
# - Status: To Do
# - Priority: Normal
# - Linked Jira Issue: Reference number
```

### Step 6: Monitor Orchestrator Pod Execution

```bash
# Check pod status
kubectl get pods -n default

# View orchestrator logs
kubectl logs -f deployment/autonomous-orchestrator -n default

# Expected log output:
# [INFO] Processing GitHub event: test/automation-e2e
# [INFO] Creating Jira issue...
# [INFO] Updating Notion database...
# [INFO] Creating ClickUp task...
# [INFO] All automation tasks completed successfully
```

### Step 7: Verify Prometheus Metrics

```bash
# Port-forward to Prometheus
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Query metrics:
# - orchestrator_commits_processed_total
# - orchestrator_jira_issues_created
# - orchestrator_notion_updates_total
# - orchestrator_clickup_tasks_created
```

### Step 8: Check Grafana Dashboards

```bash
# Port-forward to Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Verify dashboards show:
# - Recent automation execution
# - Pod CPU/Memory usage
# - API request latencies
# - Error rates (should be 0%)
```

### Step 9: Verify Slack Notification

Check Slack channel for alert message:
```
[AUTOMATION ALERT]
GitHub Commit Processed Successfully
Repository: civic-digital-infrastructure-platform
Branch: test/automation-e2e
Timestamp: [current time]
Status: SUCCESS
```

### Step 10: Performance Metrics

Measure and record:
- GitHub commit to Jira creation: ___ seconds
- GitHub commit to Notion update: ___ seconds
- GitHub commit to ClickUp task: ___ seconds
- Total end-to-end time: ___ seconds
- Orchestrator pod success rate: ___% 

### Success Criteria

✅ Test passes if ALL of the following are true:

1. GitHub commit successfully pushed
2. Zapier webhook triggered (visible in execution history)
3. Jira issue created with correct data
4. Notion database entry created and linked
5. ClickUp task created and assigned
6. Orchestrator pod processed event successfully
7. Prometheus metrics recorded
8. Grafana dashboard updated
9. Slack notification sent
10. No errors in pod logs

### Troubleshooting

#### Zapier webhook not triggering
```bash
# Check Zapier webhook URL
# Verify GitHub repo webhook configuration
# Test webhook manually:
curl -X POST https://hooks.zapier.com/hooks/catch/YOUR_WEBHOOK_ID/ \
  -H 'Content-Type: application/json' \
  -d '{"message": "test commit"}'
```

#### Jira issue not created
```bash
# Check Zapier step logs
# Verify Jira API credentials
# Validate field mappings
# Check project permissions
```

#### Orchestrator pod failing
```bash
# View detailed pod logs
kubectl describe pod <pod-name> -n default

# Check pod events
kubectl get events -n default --sort-by='.lastTimestamp'

# Check container logs
kubectl logs <pod-name> -c orchestrator -n default
```

#### Slack notification not received
```bash
# Verify webhook URL
# Check AlertManager configuration
# Test webhook manually:
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -d 'payload={"text":"Test notification"}'
```

### Cleanup After Test

```bash
# Delete test branch
git branch -D test/automation-e2e
git push origin --delete test/automation-e2e

# Archive test Jira issue
# Remove test Notion entry
# Delete test ClickUp task
```

### Generate Test Report

Document results:
- Date/Time of test
- All verification points passed/failed
- Performance metrics
- Any issues encountered
- System stability assessment

---

## Success! 

If all steps pass, the full automation pipeline is operational and ready for production use.
