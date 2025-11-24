import { Pool } from 'pg';
import Redis from 'ioredis';

/**
 * Analytics metrics types
 */
export interface AnalyticsMetrics {
  id: string;
  timestamp: Date;
  eventType: string;
  userId?: string;
  tenantId: string;
  data: Record<string, any>;
}

export interface DashboardStats {
  totalUsers: number;
  activePolicies: number;
  totalVotes: number;
  transactionCount: number;
  avgResponseTime: number;
  systemHealth: number;
}

export interface MetricTimeseries {
  timestamp: number[];
  values: number[];
  label: string;
}

/**
 * Analytics Service
 * Provides comprehensive analytics and dashboard data
 */
export class AnalyticsService {
  private db: Pool;
  private cache: Redis;
  private cacheTTL: number = 300; // 5 minutes

  constructor(db: Pool, cache: Redis) {
    this.db = db;
    this.cache = cache;
  }

  /**
   * Record an analytics event
   */
  public async recordEvent(metrics: AnalyticsMetrics): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO analytics (id, timestamp, event_type, user_id, tenant_id, data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          metrics.id,
          metrics.timestamp,
          metrics.eventType,
          metrics.userId,
          metrics.tenantId,
          JSON.stringify(metrics.data),
        ]
      );

      // Invalidate cache for this tenant
      await this.cache.del(`analytics:stats:${metrics.tenantId}`);
    } catch (error) {
      console.error('Error recording analytics event:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  public async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    const cacheKey = `analytics:stats:${tenantId}`;

    // Try cache first
    const cachedStats = await this.cache.get(cacheKey);
    if (cachedStats) {
      return JSON.parse(cachedStats);
    }

    try {
      const [usersResult, policiesResult, votesResult, transactionsResult] =
        await Promise.all([
          this.db.query(
            `SELECT COUNT(DISTINCT user_id) as count FROM users WHERE tenant_id = $1`,
            [tenantId]
          ),
          this.db.query(
            `SELECT COUNT(*) as count FROM policies WHERE tenant_id = $1 AND status = 'active'`,
            [tenantId]
          ),
          this.db.query(
            `SELECT COUNT(*) as count FROM votes WHERE tenant_id = $1`,
            [tenantId]
          ),
          this.db.query(
            `SELECT COUNT(*) as count FROM blockchain_records WHERE tenant_id = $1`,
            [tenantId]
          ),
        ]);

      const stats: DashboardStats = {
        totalUsers: parseInt(usersResult.rows[0]?.count || '0', 10),
        activePolicies: parseInt(policiesResult.rows[0]?.count || '0', 10),
        totalVotes: parseInt(votesResult.rows[0]?.count || '0', 10),
        transactionCount: parseInt(transactionsResult.rows[0]?.count || '0', 10),
        avgResponseTime: await this.calculateAvgResponseTime(tenantId),
        systemHealth: await this.calculateSystemHealth(tenantId),
      };

      // Cache the results
      await this.cache.setex(
        cacheKey,
        this.cacheTTL,
        JSON.stringify(stats)
      );

      return stats;
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get metrics timeseries data
   */
  public async getMetricsTimeseries(
    tenantId: string,
    eventType: string,
    hours: number = 24
  ): Promise<MetricTimeseries> {
    try {
      const result = await this.db.query(
        `SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as count
         FROM analytics
         WHERE tenant_id = $1 AND event_type = $2 AND timestamp >= NOW() - INTERVAL '1 hour' * $3
         GROUP BY DATE_TRUNC('hour', timestamp)
         ORDER BY hour ASC`,
        [tenantId, eventType, hours]
      );

      const timestamps: number[] = [];
      const values: number[] = [];

      for (const row of result.rows) {
        timestamps.push(new Date(row.hour).getTime());
        values.push(parseInt(row.count, 10));
      }

      return {
        timestamp: timestamps,
        values,
        label: eventType,
      };
    } catch (error) {
      console.error('Error getting metrics timeseries:', error);
      throw error;
    }
  }

  /**
   * Calculate average response time
   */
  private async calculateAvgResponseTime(tenantId: string): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT AVG(response_time) as avg_time
         FROM analytics
         WHERE tenant_id = $1 AND data->>'response_time' IS NOT NULL
         AND timestamp >= NOW() - INTERVAL '1 hour'`,
        [tenantId]
      );

      return parseFloat(result.rows[0]?.avg_time || '0');
    } catch (error) {
      console.error('Error calculating average response time:', error);
      return 0;
    }
  }

  /**
   * Calculate system health score (0-100)
   */
  private async calculateSystemHealth(tenantId: string): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT
          CASE
            WHEN COUNT(*) = 0 THEN 100
            ELSE 100 - (COUNT(CASE WHEN data->>'error' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*))
          END as health
         FROM analytics
         WHERE tenant_id = $1 AND timestamp >= NOW() - INTERVAL '1 hour'`,
        [tenantId]
      );

      return Math.max(0, Math.min(100, parseFloat(result.rows[0]?.health || '100')));
    } catch (error) {
      console.error('Error calculating system health:', error);
      return 100;
    }
  }

  /**
   * Get top performing policies
   */
  public async getTopPolicies(
    tenantId: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT 
          p.id,
          p.title,
          COUNT(v.id) as vote_count,
          AVG(a.data->>'engagement') as engagement_score
         FROM policies p
         LEFT JOIN votes v ON p.id = v.policy_id
         LEFT JOIN analytics a ON p.id = a.data->>'policy_id'
         WHERE p.tenant_id = $1
         GROUP BY p.id, p.title
         ORDER BY vote_count DESC
         LIMIT $2`,
        [tenantId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting top policies:', error);
      return [];
    }
  }

  /**
   * Get user engagement statistics
   */
  public async getUserEngagementStats(tenantId: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT 
          DATE_TRUNC('day', created_at) as day,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as total_events
         FROM analytics
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE_TRUNC('day', created_at)
         ORDER BY day DESC`,
        [tenantId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting user engagement stats:', error);
      return [];
    }
  }

  /**
   * Export analytics data
   */
  public async exportAnalyticsData(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<string> {
    try {
      const result = await this.db.query(
        `SELECT * FROM analytics
         WHERE tenant_id = $1
         AND timestamp BETWEEN $2 AND $3
         ORDER BY timestamp DESC`,
        [tenantId, startDate, endDate]
      );

      if (format === 'json') {
        return JSON.stringify(result.rows, null, 2);
      } else {
        // Simple CSV export
        const headers = Object.keys(result.rows[0] || {}).join(',');
        const rows = result.rows
          .map((row) =>
            Object.values(row)
              .map((v) => (typeof v === 'string' ? `"${v}"` : v))
              .join(',')
          )
          .join('\n');
        return `${headers}\n${rows}`;
      }
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Analytics service health check failed:', error);
      return false;
    }
  }
}

export default AnalyticsService;
