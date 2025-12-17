import { Logger } from '../utils/logger';

export enum RateLimitStrategy {
  FIXED_WINDOW = 'FIXED_WINDOW',
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  TOKEN_BUCKET = 'TOKEN_BUCKET',
  LEAKY_BUCKET = 'LEAKY_BUCKET'
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  strategy?: RateLimitStrategy;
  keyPrefix?: string;
  onRateLimitExceeded?: (clientId: string, config: RateLimitConfig) => void;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();
  private config: Required<RateLimitConfig>;
  private logger: Logger;
  private cleanupInterval: NodeJS.Timer;

  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      strategy: config.strategy || RateLimitStrategy.SLIDING_WINDOW,
      keyPrefix: config.keyPrefix || 'rl:',
      onRateLimitExceeded: config.onRateLimitExceeded || (() => {})
    };
    this.logger = Logger.getInstance();
    this.setupCleanup();
  }

  private setupCleanup(): void {
    // Clean up expired entries every 10 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let removed = 0;
      for (const [key, record] of this.store.entries()) {
        if (now > record.resetTime) {
          this.store.delete(key);
          removed++;
        }
      }
      if (removed > 0) {
        this.logger.debug(`Rate limiter cleanup: removed ${removed} expired entries`);
      }
    }, 10 * 60 * 1000);
  }

  public async checkLimit(clientId: string): Promise<RateLimitStatus> {
    const key = `${this.config.keyPrefix}${clientId}`;
    const now = Date.now();
    const record = this.store.get(key) || this.createNewRecord();

    // Check if window has expired
    if (now >= record.resetTime) {
      record.requests = 0;
      record.resetTime = now + this.config.windowMs;
      record.startTime = now;
    }

    const allowed = record.requests < this.config.maxRequests;

    if (allowed) {
      record.requests++;
    } else {
      this.config.onRateLimitExceeded(clientId, this.config);
      this.logger.warn(
        `Rate limit exceeded for ${clientId}: ${record.requests}/${this.config.maxRequests}`
      );
    }

    this.store.set(key, record);

    const remaining = Math.max(0, this.config.maxRequests - record.requests);
    const retryAfter = allowed ? undefined : Math.ceil((record.resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      resetTime: record.resetTime,
      retryAfter
    };
  }

  public async checkLimitBurst(clientId: string, burstSize: number = 1): Promise<RateLimitStatus> {
    const key = `${this.config.keyPrefix}${clientId}`;
    const now = Date.now();
    const record = this.store.get(key) || this.createNewRecord();

    // Check if window has expired
    if (now >= record.resetTime) {
      record.requests = 0;
      record.resetTime = now + this.config.windowMs;
      record.startTime = now;
    }

    const allowed = record.requests + burstSize <= this.config.maxRequests;

    if (allowed) {
      record.requests += burstSize;
    } else {
      this.config.onRateLimitExceeded(clientId, this.config);
    }

    this.store.set(key, record);

    const remaining = Math.max(0, this.config.maxRequests - record.requests);
    const retryAfter = allowed ? undefined : Math.ceil((record.resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      resetTime: record.resetTime,
      retryAfter
    };
  }

  public getStatus(clientId: string): RateLimitStatus | null {
    const key = `${this.config.keyPrefix}${clientId}`;
    const record = this.store.get(key);

    if (!record) {
      return null;
    }

    const now = Date.now();
    if (now >= record.resetTime) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    return {
      allowed: record.requests < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - record.requests),
      resetTime: record.resetTime
    };
  }

  public reset(clientId?: string): void {
    if (clientId) {
      const key = `${this.config.keyPrefix}${clientId}`;
      this.store.delete(key);
      this.logger.info(`Rate limiter reset for client: ${clientId}`);
    } else {
      this.store.clear();
      this.logger.info('Rate limiter reset for all clients');
    }
  }

  public getMetrics(): { activeClients: number; totalRequests: number } {
    let totalRequests = 0;
    for (const record of this.store.values()) {
      totalRequests += record.requests;
    }
    return {
      activeClients: this.store.size,
      totalRequests
    };
  }

  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  private createNewRecord(): RateLimitRecord {
    const now = Date.now();
    return {
      requests: 0,
      startTime: now,
      resetTime: now + this.config.windowMs
    };
  }
}

interface RateLimitRecord {
  requests: number;
  startTime: number;
  resetTime: number;
}
