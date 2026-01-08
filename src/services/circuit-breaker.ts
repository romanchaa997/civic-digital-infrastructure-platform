import { Logger } from '../utils/logger';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Number of failures before opening
  successThreshold?: number; // Number of successes to close when half-open
  timeout?: number; // Time in ms before trying half-open
  onStateChange?: (state: CircuitBreakerState) => void;
  onSuccess?: () => void;
  onFailure?: () => void;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  successCount: number;
  failureCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  openedAt?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private openedAt?: number;
  private nextAttemptTime?: number;
  private config: Required<CircuitBreakerConfig>;
  private logger: Logger;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000, // 1 minute default
      onStateChange: config.onStateChange || (() => {}),
      onSuccess: config.onSuccess || (() => {}),
      onFailure: config.onFailure || (() => {})
    };
    this.logger = Logger.getInstance();
  }

  public async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    // Check if we should attempt to close the circuit
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.canAttemptReset()) {
        this.setState(CircuitBreakerState.HALF_OPEN);
      } else {
        // Circuit is open, use fallback if available
        if (fallback) {
          this.logger.debug('Circuit is open, using fallback');
          return fallback instanceof Function ? await fallback() : fallback;
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.config.onSuccess();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.setState(CircuitBreakerState.CLOSED);
        this.successCount = 0;
      }
    }

    this.logger.debug(
      `Circuit breaker success: ${this.state} (failures: ${this.failureCount}, successes: ${this.successCount})`
    );
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0; // Reset success count on failure
    this.lastFailureTime = Date.now();
    this.config.onFailure();

    if (this.state === CircuitBreakerState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.setState(CircuitBreakerState.OPEN);
        this.openedAt = Date.now();
        this.nextAttemptTime = Date.now() + this.config.timeout;
      }
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Immediately re-open if failure in half-open state
      this.setState(CircuitBreakerState.OPEN);
      this.openedAt = Date.now();
      this.nextAttemptTime = Date.now() + this.config.timeout;
    }

    this.logger.warn(
      `Circuit breaker failure: ${this.state} (failures: ${this.failureCount}, successes: ${this.successCount})`
    );
  }

  private canAttemptReset(): boolean {
    return this.nextAttemptTime !== undefined && Date.now() >= this.nextAttemptTime;
  }

  private setState(newState: CircuitBreakerState): void {
    if (newState !== this.state) {
      this.logger.info(`Circuit breaker state changed: ${this.state} -> ${newState}`);
      this.state = newState;
      this.config.onStateChange(newState);

      if (newState === CircuitBreakerState.CLOSED) {
        this.failureCount = 0;
        this.successCount = 0;
      }
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }

  public getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt
    };
  }

  public reset(): void {
    this.setState(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.openedAt = undefined;
    this.nextAttemptTime = undefined;
    this.logger.info('Circuit breaker reset to CLOSED state');
  }

  public isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  public isHalfOpen(): boolean {
    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  public isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }
}
