#!/bin/bash

# Prometheus + Grafana Monitoring & Slack Integration Setup
# Phase 3: Complete Observability and Alerting Configuration
# Project: Civic Digital Infrastructure Platform

set -e

# Configuration
NAMESPACE="monitoring"
RELEASE_NAME="prometheus"
CHART_REPO="prometheus-community"
CHART_NAME="kube-prometheus-stack"
REGION="eu-central-1"
GRAFANA_PASSWORD="ChangeMeToSecure123!"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Prometheus & Grafana Installation..."

# Step 1: Create monitoring namespace
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating monitoring namespace..."
kubectl create namespace "$NAMESPACE" || echo "Namespace may already exist"

# Step 2: Add Prometheus Helm repository
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Adding Prometheus Helm repository..."
helm repo add "$CHART_REPO" https://prometheus-community.github.io/helm-charts
helm repo update

# Step 3: Create Prometheus values file
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating Prometheus values configuration..."
cat > prometheus-values.yaml <<EOF
prometheus:
  prometheusSpec:
    retention: 30d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
    externalLabels:
      cluster: "autonomous-orchestrator-eks"
      region: "$REGION"

grafana:
  adminPassword: "$GRAFANA_PASSWORD"
  persistence:
    enabled: true
    size: 10Gi
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus-operated:9090
        access: proxy
        isDefault: true

alertmanager:
  enabled: true
  config:
    global:
      resolve_timeout: 5m
    route:
      group_by: ['alertname', 'cluster']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'null'
      routes:
      - match:
          alertname: Watchdog
        receiver: 'null'
EOF

echo "Prometheus values file created"

# Step 4: Install kube-prometheus-stack
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing kube-prometheus-stack..."
helm install "$RELEASE_NAME" "$CHART_REPO"/"$CHART_NAME" \
  --namespace "$NAMESPACE" \
  --values prometheus-values.yaml \
  --wait

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Prometheus stack installed successfully"

# Step 5: Wait for Grafana deployment
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for Grafana deployment..."
kubectl rollout status deployment/prometheus-grafana -n "$NAMESPACE" --timeout=5m

# Step 6: Get Grafana service
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying monitoring stack..."
echo ""
echo "Monitoring Resources:"
kubectl get pods -n "$NAMESPACE"
echo ""
echo "Services:"
kubectl get svc -n "$NAMESPACE"

# Step 7: Create port-forward instructions
echo ""
echo "============================================"
echo "SUCCESS: Monitoring Stack Deployed!"
echo "============================================"
echo ""
echo "Access Grafana:"
echo "kubectl port-forward -n $NAMESPACE svc/prometheus-grafana 3000:80"
echo "Then visit: http://localhost:3000"
echo "Username: admin"
echo "Password: $GRAFANA_PASSWORD"
echo ""
echo "Access Prometheus:"
echo "kubectl port-forward -n $NAMESPACE svc/prometheus-operated 9090:9090"
echo "Then visit: http://localhost:9090"
echo ""
echo "View Prometheus Alerts:"
echo "kubectl port-forward -n $NAMESPACE svc/prometheus-kube-prom-alertmanager 9093:9093"
echo "Then visit: http://localhost:9093"
echo ""
echo "Next Steps:"
echo "1. Port-forward to Grafana"
echo "2. Login with credentials above"
echo "3. Configure Slack webhook for alerts"
echo "4. Create custom dashboards"
echo "5. Configure alert notification channels"
echo ""

# Step 8: Instructions for Slack integration
echo "Slack Integration Instructions:"
echo "1. Go to your Slack workspace"
echo "2. Create an Incoming Webhook URL"
echo "3. Update AlertManager configuration with webhook URL"
echo "4. Command to edit AlertManager config:"
echo "   kubectl edit secret alertmanager-prometheus-kube-prom-alertmanager -n $NAMESPACE"
echo ""
echo "Example Slack route in AlertManager:"
echo "  receivers:"
echo "  - name: 'slack-notifications'"
echo "    slack_configs:"
echo "    - api_url: 'YOUR_SLACK_WEBHOOK_URL'"
echo "      channel: '#alerts'"
echo "      title: 'Alert: {{ .GroupLabels.alertname }}'"
echo "      text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'"
echo ""
