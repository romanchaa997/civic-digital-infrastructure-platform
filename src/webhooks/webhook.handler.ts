import { Request, Response } from 'express';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

/**
 * Webhook event types supported by the platform
 */
type WebhookEventType =
  | 'policy.created'
  | 'policy.updated'
  | 'policy.deleted'
  | 'vote.submitted'
  | 'audit.logged'
  | 'blockchain.recorded'
  | 'notification.sent';

/**
 * Webhook payload structure
 */
interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: number;
  data: Record<string, any>;
  signature: string;
}

/**
 * Webhook subscription record
 */
interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
  retryCount: number;
  maxRetries: number;
}

/**
 * Webhook Event Handler Service
 * Manages webhook event dispatching and delivery
 */
export class WebhookHandler extends EventEmitter {
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private failedEvents: WebhookPayload[] = [];
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 seconds

  /**
   * Register a new webhook subscription
   */
  public async registerWebhook(
    url: string,
    events: WebhookEventType[],
    secret: string
  ): Promise<WebhookSubscription> {
    const subscription: WebhookSubscription = {
      id: crypto.randomUUID(),
      url,
      events,
      secret,
      active: true,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.maxRetries,
    };

    this.subscriptions.set(subscription.id, subscription);
    this.emit('webhook:registered', subscription);
    return subscription;
  }

  /**
   * Unregister a webhook subscription
   */
  public async unregisterWebhook(webhookId: string): Promise<boolean> {
    const removed = this.subscriptions.delete(webhookId);
    if (removed) {
      this.emit('webhook:unregistered', webhookId);
    }
    return removed;
  }

  /**
   * Get all active subscriptions
   */
  public getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.active
    );
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  public verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Dispatch webhook event to all matching subscriptions
   */
  public async dispatchWebhook(
    event: WebhookEventType,
    data: Record<string, any>
  ): Promise<void> {
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      event,
      timestamp: Date.now(),
      data,
      signature: '', // Will be set per subscription
    };

    const activeSubscriptions = this.getSubscriptions().filter((sub) =>
      sub.events.includes(event)
    );

    for (const subscription of activeSubscriptions) {
      await this.deliverWebhook(payload, subscription);
    }
  }

  /**
   * Deliver webhook to a specific subscription with retry logic
   */
  private async deliverWebhook(
    payload: WebhookPayload,
    subscription: WebhookSubscription
  ): Promise<void> {
    const payloadString = JSON.stringify(payload.data);
    const signature = this.generateSignature(payloadString, subscription.secret);
    const webhookPayload: WebhookPayload = { ...payload, signature };

    let attempts = 0;
    while (attempts < subscription.maxRetries) {
      try {
        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-ID': payload.id,
            'X-Webhook-Event': payload.event,
          },
          body: JSON.stringify(webhookPayload),
          timeout: 10000,
        });

        if (response.ok) {
          subscription.lastTriggeredAt = new Date();
          subscription.retryCount = 0;
          this.emit('webhook:delivered', { payload, subscription });
          return;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        attempts++;
        if (attempts < subscription.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * attempts)
          );
        } else {
          this.failedEvents.push(webhookPayload);
          subscription.retryCount++;
          if (subscription.retryCount >= 3) {
            subscription.active = false;
          }
          this.emit('webhook:failed', {
            payload,
            subscription,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Get failed events for retry
   */
  public getFailedEvents(): WebhookPayload[] {
    return [...this.failedEvents];
  }

  /**
   * Retry failed webhooks
   */
  public async retryFailedWebhooks(): Promise<void> {
    const eventsToRetry = [...this.failedEvents];
    this.failedEvents = [];

    for (const event of eventsToRetry) {
      const subscriptions = this.getSubscriptions().filter((sub) =>
        sub.events.includes(event.event)
      );

      for (const subscription of subscriptions) {
        await this.deliverWebhook(event, subscription);
      }
    }
  }

  /**
   * Health check endpoint
   */
  public async healthCheck(): Promise<{
    status: string;
    subscriptions: number;
    failedEvents: number;
  }> {
    return {
      status: 'healthy',
      subscriptions: this.subscriptions.size,
      failedEvents: this.failedEvents.length,
    };
  }
}

/**
 * Express middleware for webhook request handling
 */
export const webhookMiddleware = (webhookHandler: WebhookHandler) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body;
      const signature = req.headers['x-webhook-signature'] as string;

      if (!signature || !webhookHandler.verifySignature(
        JSON.stringify(payload.data),
        signature,
        process.env.WEBHOOK_SECRET || ''
      )) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Process webhook
      res.status(202).json({ received: true });
      
      // Emit event for processing
      webhookHandler.emit('webhook:received', payload);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid payload',
      });
    }
  };
};

// Export types
export type { WebhookPayload, WebhookSubscription, WebhookEventType };
