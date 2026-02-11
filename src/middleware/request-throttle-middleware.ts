import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

interface ThrottleConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  skip?: (req: Request) => boolean;
  onLimitReached?: (clientId: string, count: number) => void;
}

interface ClientThrottle {
  count: number;
  resetTime: number;
  lastRequest: number;
  avgResponseTime: number;
}

export class RequestThrottleMiddleware {
  private throttleMap: Map<string, ClientThrottle> = new Map();
  private config: ThrottleConfig;
  private logger: Logger;
  private cleanupInterval: NodeJS.Timer;

  constructor(config: ThrottleConfig) {
    this.config = {
      maxRequests: 100,
      windowMs: 60000, // 1 minute default
      keyGenerator: (req: Request) => req.ip || 'unknown',
      ...config
    };
    this.logger = Logger.getInstance();
    this.setupCleanup();
  }

  private setupCleanup(): void {
    // Clean up expired throttle entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, throttle] of this.throttleMap.entries()) {
        if (now > throttle.resetTime) {
          this.throttleMap.delete(key);
        }
      }
      this.logger.debug(`Throttle map cleanup: ${this.throttleMap.size} active clients`);
    }, 5 * 60 * 1000);
  }

  public middleware = () => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Skip throttling if configured
        if (this.config.skip && this.config.skip(req)) {
          return next();
        }

        const clientId = this.config.keyGenerator!(req);
        const now = Date.now();
        const throttle = this.throttleMap.get(clientId) || this.createNewThrottle();

        // Check if window has expired
        if (now >= throttle.resetTime) {
          throttle.count = 0;
          throttle.resetTime = now + this.config.windowMs!;
        }

        throttle.count++;
        throttle.lastRequest = now;

        // Add throttle info to response headers
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests!);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests! - throttle.count));
        res.setHeader('X-RateLimit-Reset', new Date(throttle.resetTime).toISOString());

        // Store throttle data back
        this.throttleMap.set(clientId, throttle);

        // Check if limit exceeded
        if (throttle.count > this.config.maxRequests!) {
          this.logger.warn(`Throttle limit exceeded for client: ${clientId}`);
          
          if (this.config.onLimitReached) {
            this.config.onLimitReached(clientId, throttle.count);
          }

          if (this.config.handler) {
            this.config.handler(req, res);
            return;
          }

          res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Maximum ${this.config.maxRequests} requests per ${this.config.windowMs}ms allowed.`,
            retryAfter: Math.ceil((throttle.resetTime - now) / 1000)
          });
          return;
        }

        next();
      } catch (error) {
        this.logger.error('Error in request throttle middleware', error);
        next();
      }
    };
  };

  private createNewThrottle(): ClientThrottle {
    return {
      count: 0,
      resetTime: Date.now() + this.config.windowMs!,
      lastRequest: Date.now(),
      avgResponseTime: 0
    };
  }

  public getStats(): { activeClients: number; totalRequests: number } {
    let totalRequests = 0;
    for (const throttle of this.throttleMap.values()) {
      totalRequests += throttle.count;
    }
    return {
      activeClients: this.throttleMap.size,
      totalRequests
    };
  }

  public resetClient(clientId: string): void {
    this.throttleMap.delete(clientId);
    this.logger.info(`Throttle reset for client: ${clientId}`);
  }

  public resetAll(): void {
    this.throttleMap.clear();
    this.logger.info('All throttle states cleared');
  }

  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.throttleMap.clear();
  }
}

// Export factory function
export function createRequestThrottleMiddleware(config: ThrottleConfig) {
  const middleware = new RequestThrottleMiddleware(config);
  return middleware.middleware();
}
