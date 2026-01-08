/**
 * Observability Platform for Civic Infrastructure
 * Comprehensive monitoring, distributed tracing, and analytics
 */

import { Logger } from '../utils/logger';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: SpanLog[];
  status: 'PENDING' | 'SUCCESS' | 'ERROR';
}

export interface SpanLog {
  timestamp: number;
  message: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  fields?: Record<string, any>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  timestamp: number;
  labels: Record<string, string>;
  unit?: string;
}

export interface Alert {
  id: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notifyChannels: string[];
}

export class ObservabilityPlatform {
  private logger: Logger;
  private spans: Map<string, Span>;
  private metrics: Map<string, Metric[]>;
  private alerts: Map<string, Alert>;
  private traces: Map<string, Span[]>;
  private activeSpans: Map<string, Span>;

  constructor() {
    this.logger = new Logger('Observability');
    this.spans = new Map();
    this.metrics = new Map();
    this.alerts = new Map();
    this.traces = new Map();
    this.activeSpans = new Map();
  }

  // Start distributed trace
  async startTrace(traceId: string, operationName: string): Promise<Span> {
    try {
      const spanId = this.generateSpanId();
      const span: Span = {
        traceId,
        spanId,
        operationName,
        startTime: Date.now(),
        tags: {},
        logs: [],
        status: 'PENDING'
      };

      this.activeSpans.set(spanId, span);
      
      if (!this.traces.has(traceId)) {
        this.traces.set(traceId, []);
      }
      this.traces.get(traceId)!.push(span);

      this.logger.info(`Trace started: ${traceId}/${spanId}`);
      return span;
    } catch (error) {
      this.logger.error('Trace start failed', error);
      throw error;
    }
  }

  // Create child span
  async createChildSpan(
    traceId: string,
    parentSpanId: string,
    operationName: string
  ): Promise<Span> {
    try {
      const spanId = this.generateSpanId();
      const span: Span = {
        traceId,
        spanId,
        parentSpanId,
        operationName,
        startTime: Date.now(),
        tags: {},
        logs: [],
        status: 'PENDING'
      };

      this.activeSpans.set(spanId, span);
      this.traces.get(traceId)?.push(span);

      return span;
    } catch (error) {
      this.logger.error('Child span creation failed', error);
      throw error;
    }
  }

  // Record metric
  async recordMetric(metric: Metric): Promise<void> {
    try {
      if (!this.metrics.has(metric.name)) {
        this.metrics.set(metric.name, []);
      }
      this.metrics.get(metric.name)!.push(metric);

      // Check alerts
      await this.checkAlerts(metric);
    } catch (error) {
      this.logger.error('Metric recording failed', error);
    }
  }

  // Finish span
  async finishSpan(
    spanId: string,
    status: 'SUCCESS' | 'ERROR' = 'SUCCESS'
  ): Promise<Span | null> {
    try {
      const span = this.activeSpans.get(spanId);
      if (!span) return null;

      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = status;

      this.activeSpans.delete(spanId);
      return span;
    } catch (error) {
      this.logger.error('Span finish failed', error);
      throw error;
    }
  }

  // Add log to span
  async logToSpan(
    spanId: string,
    message: string,
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    fields?: Record<string, any>
  ): Promise<void> {
    try {
      const span = this.activeSpans.get(spanId) || 
                  Array.from(this.spans.values()).find(s => s.spanId === spanId);
      
      if (span) {
        span.logs.push({
          timestamp: Date.now(),
          message,
          level,
          fields
        });
      }
    } catch (error) {
      this.logger.error('Log recording failed', error);
    }
  }

  // Register alert
  async registerAlert(alert: Alert): Promise<void> {
    try {
      this.alerts.set(alert.id, alert);
      this.logger.info(`Alert registered: ${alert.id}`);
    } catch (error) {
      this.logger.error('Alert registration failed', error);
      throw error;
    }
  }

  // Query traces by criteria
  async queryTraces(
    filter: {
      minDuration?: number;
      maxDuration?: number;
      status?: 'SUCCESS' | 'ERROR';
      operationName?: string;
      tag?: { key: string; value: string };
    },
    limit: number = 100
  ): Promise<Span[][]> {
    try {
      const results: Span[][] = [];

      for (const [traceId, spans] of this.traces) {
        let matches = true;
        const trace = spans.filter(s => {
          if (filter.minDuration && (s.duration || 0) < filter.minDuration) return false;
          if (filter.maxDuration && (s.duration || 0) > filter.maxDuration) return false;
          if (filter.status && s.status !== filter.status) return false;
          if (filter.operationName && s.operationName !== filter.operationName) return false;
          if (filter.tag && s.tags[filter.tag.key] !== filter.tag.value) return false;
          return true;
        });

        if (trace.length > 0) {
          results.push(trace);
          if (results.length >= limit) break;
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Trace query failed', error);
      throw error;
    }
  }

  // Get metric statistics
  async getMetricStatistics(metricName: string): Promise<{
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p99: number;
  }> {
    try {
      const metrics = this.metrics.get(metricName) || [];
      if (metrics.length === 0) {
        return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p99: 0 };
      }

      const values = metrics.map(m => m.value).sort((a, b) => a - b);
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);

      return {
        count,
        min: values[0],
        max: values[count - 1],
        avg: sum / count,
        p50: values[Math.floor(count * 0.5)],
        p99: values[Math.floor(count * 0.99)]
      };
    } catch (error) {
      this.logger.error('Metric statistics calculation failed', error);
      throw error;
    }
  }

  // Anomaly detection
  async detectAnomalies(metricName: string): Promise<{
    anomalies: Metric[];
    threshold: number;
    mean: number;
    stdDev: number;
  }> {
    try {
      const metrics = this.metrics.get(metricName) || [];
      if (metrics.length < 10) {
        return { anomalies: [], threshold: 0, mean: 0, stdDev: 0 };
      }

      const values = metrics.map(m => m.value);
      const mean = values.reduce((a, b) => a + b) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      const threshold = mean + 3 * stdDev;

      const anomalies = metrics.filter(m => m.value > threshold);

      return { anomalies, threshold, mean, stdDev };
    } catch (error) {
      this.logger.error('Anomaly detection failed', error);
      throw error;
    }
  }

  // Health check
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeTraces: number;
    activeMetrics: number;
    alertsFired: number;
  }> {
    try {
      const activeTraces = this.traces.size;
      const activeMetrics = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.length, 0);
      const alertsFired = Array.from(this.alerts.values()).filter(a => a.enabled).length;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (alertsFired > 5) status = 'degraded';
      if (alertsFired > 10) status = 'unhealthy';

      return {
        status,
        activeTraces,
        activeMetrics,
        alertsFired
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }

  // Helper: Generate span ID
  private generateSpanId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper: Check alerts
  private async checkAlerts(metric: Metric): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (alert.enabled && metric.name.includes(alert.condition)) {
        if (metric.value > alert.threshold) {
          this.logger.warn(`Alert triggered: ${alert.id} (severity: ${alert.severity})`);
        }
      }
    }
  }

  // Export metrics for analysis
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    try {
      if (format === 'prometheus') {
        let prometheus = '';
        for (const [name, metrics] of this.metrics) {
          for (const metric of metrics) {
            const labels = Object.entries(metric.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',');
            prometheus += `${name}{${labels}} ${metric.value}\n`;
          }
        }
        return prometheus;
      }

      return JSON.stringify({
        metrics: Array.from(this.metrics.entries()).map(([name, metrics]) => ({
          name,
          samples: metrics
        }))
      });
    } catch (error) {
      this.logger.error('Metrics export failed', error);
      throw error;
    }
  }
}

export default ObservabilityPlatform;
