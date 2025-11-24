/**
 * Security Middleware
 * Implements rate limiting and API key authentication
 */

import { Request, Response, NextFunction } from 'express';
import { envConfig } from '../utils/env.validation';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(
    windowMs: number = envConfig.RATE_LIMIT_WINDOW_MS,
    maxRequests: number = envConfig.RATE_LIMIT_MAX_REQUESTS
  ) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const record = this.store[key];

      if (!record || now > record.resetTime) {
        this.store[key] = { count: 1, resetTime: now + this.windowMs };
        return next();
      }

      if (record.count >= this.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        });
      }

      record.count++;
      next();
    };
  }
}

/**
 * API Key Authentication Middleware
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // In production, validate against a secure store or database
  const validKeys = [envConfig.API_KEY_SECRET];

  if (!validKeys.includes(apiKey)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
};

/**
 * CORS Configuration
 */
export const corsConfig = {
  origin: envConfig.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
};

/**
 * Input Validation Middleware
 */
export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = (req.query[key] as string)
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, '');
      }
    }
  }

  next();
};

// Export rate limiter instance
export const rateLimiter = new RateLimiter();

export default { apiKeyAuth, rateLimiter, corsConfig, validateInput };
