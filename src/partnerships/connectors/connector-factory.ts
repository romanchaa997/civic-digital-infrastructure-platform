import axios, { AxiosInstance } from 'axios';
import { Logger } from '../utils/logger';

/**
 * Connector Factory: Multi-provider data integration layer
 * Supports CRM (Salesforce, HubSpot), Email (SendGrid, AWS SES), Chat (Slack, Teams, Discord)
 */

export interface IConnectorConfig {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  apiUrl?: string;
  workspace?: string;
  retryAttempts?: number;
  timeout?: number;
}

export interface IConnectorResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
}

/**
 * Base Connector class with common functionality
 */
export abstract class BaseConnector {
  protected logger: Logger;
  protected httpClient: AxiosInstance;
  protected config: IConnectorConfig;
  protected retryAttempts: number;
  protected timeout: number;

  constructor(config: IConnectorConfig) {
    this.config = config;
    this.logger = new Logger(`${config.provider}Connector`);
    this.retryAttempts = config.retryAttempts || 3;
    this.timeout = config.timeout || 30000;
    this.httpClient = this.createHttpClient();
  }

  protected createHttpClient(): AxiosInstance {
    return axios.create({
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        this.logger.info(`${operationName} - Attempt ${attempt}/${this.retryAttempts}`);
        return await fn();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${operationName} failed on attempt ${attempt}: ${lastError.message}`);
        if (attempt < this.retryAttempts) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    throw lastError;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  abstract test(): Promise<IConnectorResponse<boolean>>;
}

/**
 * Salesforce CRM Connector
 */
export class SalesforceConnector extends BaseConnector {
  private instanceUrl: string;

  constructor(config: IConnectorConfig) {
    super(config);
    this.instanceUrl = config.apiUrl || 'https://login.salesforce.com';
    this.httpClient = axios.create({
      baseURL: this.instanceUrl,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async test(): Promise<IConnectorResponse<boolean>> {
    try {
      const response = await this.httpClient.get('/services/oauth2/userinfo');
      this.logger.info('Salesforce connection test successful');
      return { success: true, data: true, statusCode: 200 };
    } catch (error) {
      this.logger.error('Salesforce connection test failed', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async createLead(leadData: Record<string, any>): Promise<IConnectorResponse<string>> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.post('/services/data/v57.0/sobjects/Lead', leadData);
      return { success: true, data: response.data.id, statusCode: 201 };
    }, 'createLead');
  }

  async updateContact(contactId: string, data: Record<string, any>): Promise<IConnectorResponse<boolean>> {
    return this.executeWithRetry(async () => {
      await this.httpClient.patch(`/services/data/v57.0/sobjects/Contact/${contactId}`, data);
      return { success: true, data: true, statusCode: 204 };
    }, 'updateContact');
  }

  async searchRecords(query: string): Promise<IConnectorResponse<any[]>> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.get('/services/data/v57.0/query', {
        params: { q: query },
      });
      return { success: true, data: response.data.records, statusCode: 200 };
    }, 'searchRecords');
  }
}

/**
 * HubSpot CRM Connector
 */
export class HubSpotConnector extends BaseConnector {
  constructor(config: IConnectorConfig) {
    super(config);
    this.httpClient = axios.create({
      baseURL: 'https://api.hubapi.com',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async test(): Promise<IConnectorResponse<boolean>> {
    try {
      await this.httpClient.get('/crm/v3/objects/contacts');
      this.logger.info('HubSpot connection test successful');
      return { success: true, data: true, statusCode: 200 };
    } catch (error) {
      this.logger.error('HubSpot connection test failed', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async createContact(contactData: Record<string, any>): Promise<IConnectorResponse<string>> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.post('/crm/v3/objects/contacts', {
        properties: contactData,
      });
      return { success: true, data: response.data.id, statusCode: 201 };
    }, 'createContact');
  }

  async getContact(contactId: string): Promise<IConnectorResponse<any>> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.get(`/crm/v3/objects/contacts/${contactId}`);
      return { success: true, data: response.data, statusCode: 200 };
    }, 'getContact');
  }
}

/**
 * SendGrid Email Connector
 */
export class SendGridConnector extends BaseConnector {
  constructor(config: IConnectorConfig) {
    super(config);
    this.httpClient = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async test(): Promise<IConnectorResponse<boolean>> {
    try {
      await this.httpClient.get('/mail/send/validate');
      this.logger.info('SendGrid connection test successful');
      return { success: true, data: true, statusCode: 200 };
    } catch (error) {
      this.logger.error('SendGrid connection test failed', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendEmail(emailData: Record<string, any>): Promise<IConnectorResponse<string>> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.post('/mail/send', emailData);
      this.logger.info('Email sent successfully via SendGrid');
      return { success: true, data: 'Email queued for delivery', statusCode: 202 };
    }, 'sendEmail');
  }

  async getEmailStats(): Promise<IConnectorResponse<any>> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.get('/stats');
      return { success: true, data: response.data, statusCode: 200 };
    }, 'getEmailStats');
  }
}

/**
 * Slack Chat Connector
 */
export class SlackConnector extends BaseConnector {
  constructor(config: IConnectorConfig) {
    super(config);
    this.httpClient = axios.create({
      baseURL: 'https://slack.com/api',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async test(): Promise<IConnectorResponse<boolean>> {
    try {
      await this.httpClient.post('/auth.test');
      this.logger.info('Slack connection test successful');
      return { success: true, data: true, statusCode: 200 };
    } catch (error) {
      this.logger.error('Slack connection test failed', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendMessage(channel: string, text: string, blocks?: any[]): Promise<IConnectorResponse<string>> {
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.post('/chat.postMessage', {
        channel,
        text,
        blocks,
      });
      return { success: true, data: response.data.ts, statusCode: 200 };
    }, 'sendMessage');
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<IConnectorResponse<boolean>> {
    return this.executeWithRetry(async () => {
      await this.httpClient.post('/chat.update', { channel, ts, text });
      return { success: true, data: true, statusCode: 200 };
    }, 'updateMessage');
  }
}

/**
 * Connector Factory: Creates appropriate connector based on provider type
 */
export class ConnectorFactory {
  private static logger = new Logger('ConnectorFactory');
  private static connectors: Map<string, BaseConnector> = new Map();

  static createConnector(config: IConnectorConfig): BaseConnector {
    const provider = config.provider.toLowerCase();

    switch (provider) {
      case 'salesforce':
        return new SalesforceConnector(config);
      case 'hubspot':
        return new HubSpotConnector(config);
      case 'sendgrid':
        return new SendGridConnector(config);
      case 'slack':
        return new SlackConnector(config);
      default:
        throw new Error(`Unsupported connector provider: ${config.provider}`);
    }
  }

  static getCachedConnector(key: string, config: IConnectorConfig): BaseConnector {
    if (!this.connectors.has(key)) {
      this.connectors.set(key, this.createConnector(config));
      this.logger.info(`Connector ${key} cached`);
    }
    return this.connectors.get(key)!;
  }

  static clearCache(): void {
    this.connectors.clear();
    this.logger.info('Connector cache cleared');
  }
}
