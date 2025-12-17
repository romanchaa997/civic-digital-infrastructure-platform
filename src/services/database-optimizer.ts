/**
 * Database Query Optimizer Service
 * Provides performance optimization for database queries
 * Features: Query caching, connection pooling, batch operations
 */

import { Logger } from '../utils/logger';

interface QueryStats {
  query: string;
  executionTime: number;
  rowsAffected: number;
  cacheHit: boolean;
}

interface OptimizerConfig {
  enableCaching: boolean;
  maxCacheSize: number;
  cacheTTL: number; // milliseconds
  batchSize: number;
  connectionPoolSize: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  hitCount: number;
}

/**
 * DatabaseOptimizer class for query optimization
 */
export class DatabaseOptimizer {
  private config: OptimizerConfig;
  private queryCache: Map<string, CacheEntry> = new Map();
  private queryStats: QueryStats[] = [];
  private logger: Logger;

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = {
      enableCaching: config.enableCaching ?? true,
      maxCacheSize: config.maxCacheSize ?? 1000,
      cacheTTL: config.cacheTTL ?? 5 * 60 * 1000, // 5 minutes default
      batchSize: config.batchSize ?? 100,
      connectionPoolSize: config.connectionPoolSize ?? 20,
    };
    this.logger = new Logger('DatabaseOptimizer');
  }

  /**
   * Execute a query with caching support
   */
  async executeQuery(
    query: string,
    params: any[] = [],
    useCache: boolean = true
  ): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, params);

    // Check cache first
    if (useCache && this.config.enableCaching) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.recordStats(query, Date.now() - startTime, 0, true);
        this.logger.debug(`Cache hit for query: ${query.substring(0, 50)}...`);
        return cachedResult;
      }
    }

    try {
      // Simulate query execution
      const result = await this.simulateQueryExecution(query, params);
      const executionTime = Date.now() - startTime;

      // Cache the result
      if (useCache && this.config.enableCaching) {
        this.cacheResult(cacheKey, result);
      }

      this.recordStats(query, executionTime, result.length || 0, false);
      return result;
    } catch (error) {
      this.logger.error(`Query execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute batch operations for bulk inserts/updates
   */
  async executeBatch(
    baseQuery: string,
    dataSet: any[],
    batchCallback?: (results: any[]) => void
  ): Promise<any[]> {
    const batches = this.splitIntoBatches(dataSet, this.config.batchSize);
    const allResults: any[] = [];

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map((item) => this.simulateQueryExecution(baseQuery, [item]))
      );
      allResults.push(...results);

      if (batchCallback) {
        batchCallback(results);
      }
    }

    this.logger.info(
      `Completed batch operation: ${dataSet.length} items in ${batches.length} batches`
    );
    return allResults;
  }

  /**
   * Clear cache for a specific query or all cache
   */
  clearCache(query?: string): void {
    if (query) {
      const keysToDelete: string[] = [];
      for (const [key, _] of this.queryCache.entries()) {
        if (key.includes(query)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.queryCache.delete(key));
      this.logger.info(`Cleared ${keysToDelete.length} cache entries for query`);
    } else {
      this.queryCache.clear();
      this.logger.info('Cleared all cache');
    }
  }

  /**
   * Get query execution statistics
   */
  getStatistics(): {
    totalQueries: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    cacheSize: number;
  } {
    const totalQueries = this.queryStats.length;
    const avgTime =
      totalQueries > 0
        ? this.queryStats.reduce((sum, stat) => sum + stat.executionTime, 0) /
          totalQueries
        : 0;
    const cacheHits = this.queryStats.filter((stat) => stat.cacheHit).length;
    const hitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    return {
      totalQueries,
      averageExecutionTime: Math.round(avgTime * 100) / 100,
      cacheHitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.queryCache.size,
    };
  }

  /**
   * Optimize query by analyzing and applying transformations
   */
  optimizeQuery(query: string): string {
    let optimized = query;

    // Remove unnecessary whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Add index hints for common patterns
    if (optimized.includes('WHERE')) {
      optimized = optimized.replace('WHERE', 'WHERE /* INDEX_HINT */'); 
    }

    // Limit results for safety
    if (!optimized.toUpperCase().includes('LIMIT')) {
      optimized += ' LIMIT 10000';
    }

    return optimized;
  }

  /**
   * Private helper methods
   */

  private generateCacheKey(query: string, params: any[]): string {
    return `${query}:${JSON.stringify(params)}`;
  }

  private getCachedResult(key: string): any | null {
    const entry = this.queryCache.get(key);
    if (!entry) return null;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.config.cacheTTL) {
      this.queryCache.delete(key);
      return null;
    }

    entry.hitCount++;
    return entry.data;
  }

  private cacheResult(key: string, data: any): void {
    // Evict oldest entry if cache is full
    if (this.queryCache.size >= this.config.maxCacheSize) {
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.queryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private splitIntoBatches<T>(array: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  }

  private async simulateQueryExecution(
    query: string,
    params: any[]
  ): Promise<any> {
    // Simulate async query execution
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock result
        resolve([{ id: 1, data: 'result', ...params }]);
      }, Math.random() * 10);
    });
  }

  private recordStats(
    query: string,
    executionTime: number,
    rowsAffected: number,
    cacheHit: boolean
  ): void {
    this.queryStats.push({
      query: query.substring(0, 100),
      executionTime,
      rowsAffected,
      cacheHit,
    });

    // Keep only last 1000 stats
    if (this.queryStats.length > 1000) {
      this.queryStats = this.queryStats.slice(-500);
    }
  }
}

export default DatabaseOptimizer;
