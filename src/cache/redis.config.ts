import Redis from 'ioredis';
import { logger } from '../monitoring/logger';

export interface RedisOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryStrategy: (times: number) => number;
  enableReadyCheck: boolean;
  enableOfflineQueue: boolean;
  maxRetriesPerRequest: number | null;
}

export class RedisConfig {
  private static instance: Redis | null = null;
  private static readonly defaultOptions: Partial<RedisOptions> = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    enableReadyCheck: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 50, 2000)
  };

  /**
   * Initialize Redis connection
   */
  static async initialize(): Promise<Redis> {
    if (this.instance) {
      return this.instance;
    }

    try {
      const options = this.getOptions();
      this.instance = new Redis(options);

      this.instance.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      this.instance.on('error', (err) => {
        logger.error(`Redis error: ${err.message}`);
      });

      this.instance.on('close', () => {
        logger.warn('Redis connection closed');
      });

      this.instance.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      // Test connection
      await this.instance.ping();
      logger.info('Redis ping successful');

      return this.instance;
    } catch (error) {
      logger.error(`Failed to initialize Redis: ${error}`);
      throw error;
    }
  }

  /**
   * Get Redis instance
   */
  static getInstance(): Redis {
    if (!this.instance) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  /**
   * Get configuration options
   */
  private static getOptions(): RedisOptions {
    return {
      ...this.defaultOptions,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    } as RedisOptions;
  }

  /**
   * Set cache value with TTL
   */
  static async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const redis = this.getInstance();
      const serialized = JSON.stringify(value);

      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SET failed for key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Get cache value
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = this.getInstance();
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis GET failed for key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Delete cache key
   */
  static async delete(key: string): Promise<boolean> {
    try {
      const redis = this.getInstance();
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL failed for key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  static async flushAll(): Promise<boolean> {
    try {
      const redis = this.getInstance();
      await redis.flushdb();
      logger.info('Redis cache flushed');
      return true;
    } catch (error) {
      logger.error(`Redis FLUSHDB failed: ${error}`);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<any> {
    try {
      const redis = this.getInstance();
      const info = await redis.info('stats');
      const dbSize = await redis.dbsize();
      return {
        info,
        keyCount: dbSize
      };
    } catch (error) {
      logger.error(`Failed to get Redis stats: ${error}`);
      return null;
    }
  }

  /**
   * Increment counter
   */
  static async increment(key: string, ttl?: number): Promise<number> {
    try {
      const redis = this.getInstance();
      const value = await redis.incr(key);

      if (ttl && value === 1) {
        await redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error(`Redis INCR failed for key ${key}: ${error}`);
      return 0;
    }
  }

  /**
   * Add to set
   */
  static async addToSet(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      const redis = this.getInstance();
      await redis.sadd(key, value);

      if (ttl) {
        await redis.expire(key, ttl);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SADD failed for key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
      logger.info('Redis connection closed');
    }
  }
}

export default RedisConfig;
