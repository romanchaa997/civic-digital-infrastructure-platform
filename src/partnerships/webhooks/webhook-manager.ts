import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Database } from '../database/connection';

/**
 * WebhookManager: Enterprise webhook delivery and event handling system
 * Supports signature verification, retry logic, and event filtering
 */

export interface IWebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  retryAttempts: number;
  retryDelay: number; // milliseconds
  timeout: number; // milliseconds
  headers?: Record<string, string>;
}

export interface IWebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  source: string;
}

export interface IWebhookDelivery {
  webhookId: string;
  eventId: string;
  attempts: number;
  lastAttempt: Date;
  nextRetry?: Date;
  status: 'pending' | 'delivered' | 'failed';
  response?: string;
}

/**
 * WebhookManager manages webhook registrations and event delivery
 */
export class WebhookManager extends EventEmitter {
  private logger = new Logger('WebhookManager');
  private webhooks: Map<string, IWebhookConfig> = new Map();
  private deliveries: Map<string, IWebhookDelivery> = new Map();
  private httpClient: AxiosInstance;
  private db: Database;
  private processingQueue: Set<string> = new Set();

  constructor(db: Database) {
    super();
    this.db = db;
    this.httpClient = axios.create({
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
    this.initializeEventListeners();
  }

  /**
   * Initialize internal event listeners
   */
  private initializeEventListeners(): void {
    this.on('event:created', (event: IWebhookEvent) => {
      this.dispatchEvent(event);
    });

    this.on('delivery:failed', (delivery: IWebhookDelivery) => {
      this.scheduleRetry(delivery);
    });
  }

  /**
   * Register a new webhook
   */
  async registerWebhook(config: IWebhookConfig): Promise<void> {
    try {
      // Validate webhook URL
      if (!this.isValidUrl(config.url)) {
        throw new Error('Invalid webhook URL');
      }

      // Store webhook
      this.webhooks.set(config.id, config);

      // Persist to database
      await this.db.query(
        `INSERT INTO webhooks (id, url, events, secret, active, retry_attempts, retry_delay, timeout, headers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          config.id,
          config.url,
          JSON.stringify(config.events),
          config.secret,
          config.active,
          config.retryAttempts,
          config.retryDelay,
          config.timeout,
          JSON.stringify(config.headers || {}),
        ]
      );

      this.logger.info(`Webhook registered: ${config.id}`);
      this.emit('webhook:registered', config);
    } catch (error) {
      this.logger.error(`Failed to register webhook ${config.id}`, error);
      throw error;
    }
  }

  /**
   * Unregister a webhook
   */
  async unregisterWebhook(webhookId: string): Promise<void> {
    try {
      this.webhooks.delete(webhookId);
      await this.db.query('DELETE FROM webhooks WHERE id = ?', [webhookId]);
      this.logger.info(`Webhook unregistered: ${webhookId}`);
      this.emit('webhook:unregistered', { id: webhookId });
    } catch (error) {
      this.logger.error(`Failed to unregister webhook ${webhookId}`, error);
      throw error;
    }
  }

  /**
   * Trigger a webhook event
   */
  async triggerEvent(event: IWebhookEvent): Promise<void> {
    try {
      // Store event in database
      const eventId = event.id;
      await this.db.query(
        `INSERT INTO webhook_events (id, type, timestamp, data, source)
         VALUES (?, ?, ?, ?, ?)`,
        [eventId, event.type, event.timestamp, JSON.stringify(event.data), event.source]
      );

      this.emit('event:created', event);
      this.logger.info(`Event triggered: ${event.type}`);
    } catch (error) {
      this.logger.error('Failed to trigger event', error);
      throw error;
    }
  }

  /**
   * Dispatch event to matching webhooks
   */
  private async dispatchEvent(event: IWebhookEvent): Promise<void> {
    for (const webhook of this.webhooks.values()) {
      if (!webhook.active) continue;
      if (!webhook.events.includes(event.type) && !webhook.events.includes('*')) continue;

      await this.deliverWebhook(webhook, event);
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(webhook: IWebhookConfig, event: IWebhookEvent): Promise<void> {
    const deliveryKey = `${webhook.id}:${event.id}`;
    if (this.processingQueue.has(deliveryKey)) {
      return; // Already processing
    }

    this.processingQueue.add(deliveryKey);

    try {
      const delivery: IWebhookDelivery = {
        webhookId: webhook.id,
        eventId: event.id,
        attempts: 0,
        lastAttempt: new Date(),
        status: 'pending',
      };

      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= webhook.retryAttempts; attempt++) {
        try {
          const signature = this.generateSignature(event, webhook.secret);
          const response = await this.httpClient.post(webhook.url, event, {
            timeout: webhook.timeout,
            headers: {
              'X-Webhook-Signature': signature,
              'X-Webhook-ID': webhook.id,
              'X-Event-Type': event.type,
              'X-Event-ID': event.id,
              'X-Delivery-ID': `${deliveryKey}:${attempt}`,
              'Content-Type': 'application/json',
              ...webhook.headers,
            },
          });

          if (response.status >= 200 && response.status < 300) {
            delivery.status = 'delivered';
            delivery.response = response.data;
            this.logger.info(`Webhook delivered successfully: ${deliveryKey}`);
            this.emit('delivery:success', delivery);
            break;
          }

          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          delivery.lastAttempt = new Date();
          delivery.attempts = attempt;
        } catch (error) {
          lastError = error as Error;
          delivery.lastAttempt = new Date();
          delivery.attempts = attempt;

          if (attempt < webhook.retryAttempts) {
            const delay = webhook.retryDelay * Math.pow(2, attempt - 1);
            await this.delay(delay);
          }
        }
      }

      if (delivery.status !== 'delivered') {
        delivery.status = 'failed';
        this.logger.warn(`Webhook delivery failed: ${deliveryKey} - ${lastError?.message}`);
        this.emit('delivery:failed', delivery);
      }

      // Store delivery record
      await this.db.query(
        `INSERT INTO webhook_deliveries (webhook_id, event_id, attempts, last_attempt, status, response)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          delivery.webhookId,
          delivery.eventId,
          delivery.attempts,
          delivery.lastAttempt,
          delivery.status,
          delivery.response,
        ]
      );
    } finally {
      this.processingQueue.delete(deliveryKey);
    }
  }

  /**
   * Schedule retry for failed delivery
   */
  private async scheduleRetry(delivery: IWebhookDelivery): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || delivery.attempts >= webhook.retryAttempts) {
      return;
    }

    const delay = webhook.retryDelay * Math.pow(2, delivery.attempts);
    delivery.nextRetry = new Date(Date.now() + delay);

    this.logger.info(`Retry scheduled for ${delivery.webhookId} in ${delay}ms`);
    setTimeout(() => {
      // Retry logic would be implemented here
    }, delay);
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(event: IWebhookEvent, secret: string): string {
    const payload = JSON.stringify(event);
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Validate webhook URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get webhook by ID
   */
  getWebhook(webhookId: string): IWebhookConfig | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks(): IWebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get delivery history
   */
  async getDeliveryHistory(webhookId: string, limit: number = 100): Promise<IWebhookDelivery[]> {
    const rows = await this.db.query(
      `SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY last_attempt DESC LIMIT ?`,
      [webhookId, limit]
    );
    return rows.map((row: any) => ({
      webhookId: row.webhook_id,
      eventId: row.event_id,
      attempts: row.attempts,
      lastAttempt: new Date(row.last_attempt),
      status: row.status,
      response: row.response,
    }));
  }

  /**
   * Get webhook statistics
   */
  async getStatistics(): Promise<Record<string, any>> {
    const stats = await this.db.query(
      `SELECT
        COUNT(*) as total_webhooks,
        SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_webhooks,
        (SELECT COUNT(*) FROM webhook_events) as total_events,
        (SELECT COUNT(*) FROM webhook_deliveries WHERE status = 'delivered') as delivered_count,
        (SELECT COUNT(*) FROM webhook_deliveries WHERE status = 'failed') as failed_count`
    );
    return stats[0];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const webhookManager = new WebhookManager(Database.getInstance());
