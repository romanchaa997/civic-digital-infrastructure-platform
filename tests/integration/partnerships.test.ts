import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { TemplateEngine } from '../../src/partnerships/templates/template-engine';
import { ConnectorFactory, IConnectorConfig } from '../../src/partnerships/connectors/connector-factory';
import { WebhookManager, IWebhookConfig, IWebhookEvent } from '../../src/partnerships/webhooks/webhook-manager';
import { WorkflowEngine } from '../../src/partnerships/core/workflow-engine';

/**
 * Integration Test Suite: AI Partnerships Orchestrator
 * Tests all major components and their integration
 */

describe('Template Engine Integration', () => {
  let templateEngine: TemplateEngine;

  beforeAll(() => {
    templateEngine = new TemplateEngine();
  });

  it('should compile and render a simple template', () => {
    const template = 'Hello {{name}}, your balance is {{formatCurrency amount}}';
    const context = { name: 'John', amount: 1500 };
    
    templateEngine.compileTemplate('welcome-email', template);
    const result = templateEngine.renderTemplate('welcome-email', context);
    
    expect(result.success).toBe(true);
    expect(result.content).toContain('Hello John');
    expect(result.content).toContain('1,500.00');
  });

  it('should sanitize XSS attempts in context', () => {
    const template = '{{userInput}}';
    const xssPayload = '<script>alert("XSS")</script>';
    const context = { userInput: xssPayload };
    
    templateEngine.compileTemplate('xss-test', template);
    const result = templateEngine.renderTemplate('xss-test', context);
    
    expect(result.success).toBe(true);
    expect(result.content).not.toContain('<script>');
    expect(result.content).toContain('&lt;script&gt;');
  });

  it('should support custom helpers', () => {
    templateEngine.registerHelper('reverse', (str: string) => {
      return str.split('').reverse().join('');
    });

    const template = '{{reverse text}}';
    const context = { text: 'hello' };
    
    templateEngine.compileTemplate('custom-helper', template);
    const result = templateEngine.renderTemplate('custom-helper', context);
    
    expect(result.content).toBe('olleh');
  });

  it('should handle template cache correctly', () => {
    const stats1 = templateEngine.getCacheStats();
    templateEngine.compileTemplate('cached-1', 'Test {{value}}');
    templateEngine.compileTemplate('cached-2', 'Test {{value}}');
    const stats2 = templateEngine.getCacheStats();
    
    expect(stats2.totalTemplates).toBeGreaterThan(stats1.totalTemplates);
    expect(stats2.cachedTemplateIds).toContain('cached-1');
    expect(stats2.cachedTemplateIds).toContain('cached-2');
  });
});

describe('Connector Factory Integration', () => {
  it('should create Salesforce connector', () => {
    const config: IConnectorConfig = {
      provider: 'salesforce',
      apiKey: 'test-token',
      apiUrl: 'https://test.salesforce.com',
    };

    const connector = ConnectorFactory.createConnector(config);
    expect(connector).toBeDefined();
  });

  it('should create HubSpot connector', () => {
    const config: IConnectorConfig = {
      provider: 'hubspot',
      apiKey: 'test-key',
    };

    const connector = ConnectorFactory.createConnector(config);
    expect(connector).toBeDefined();
  });

  it('should create SendGrid connector', () => {
    const config: IConnectorConfig = {
      provider: 'sendgrid',
      apiKey: 'test-key',
    };

    const connector = ConnectorFactory.createConnector(config);
    expect(connector).toBeDefined();
  });

  it('should throw error for unsupported provider', () => {
    const config: IConnectorConfig = {
      provider: 'unsupported-provider',
      apiKey: 'test-key',
    };

    expect(() => ConnectorFactory.createConnector(config)).toThrow(
      'Unsupported connector provider: unsupported-provider'
    );
  });

  it('should cache connectors correctly', () => {
    const config: IConnectorConfig = {
      provider: 'slack',
      apiKey: 'test-key',
    };

    const connector1 = ConnectorFactory.getCachedConnector('slack-1', config);
    const connector2 = ConnectorFactory.getCachedConnector('slack-1', config);

    expect(connector1).toBe(connector2);
  });
});

describe('Webhook Manager Integration', () => {
  let webhookManager: WebhookManager;
  const mockDb: any = {
    query: jest.fn().mockResolvedValue([]),
  };

  beforeAll(() => {
    webhookManager = new WebhookManager(mockDb);
  });

  it('should register a webhook', async () => {
    const config: IWebhookConfig = {
      id: 'webhook-1',
      url: 'https://example.com/webhook',
      events: ['partnership.created', 'partnership.updated'],
      secret: 'test-secret',
      active: true,
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 5000,
    };

    await webhookManager.registerWebhook(config);
    const webhook = webhookManager.getWebhook('webhook-1');

    expect(webhook).toBeDefined();
    expect(webhook?.url).toBe('https://example.com/webhook');
    expect(webhook?.active).toBe(true);
  });

  it('should reject invalid webhook URLs', async () => {
    const config: IWebhookConfig = {
      id: 'webhook-2',
      url: 'not-a-valid-url',
      events: ['partnership.created'],
      secret: 'test-secret',
      active: true,
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 5000,
    };

    await expect(webhookManager.registerWebhook(config)).rejects.toThrow('Invalid webhook URL');
  });

  it('should verify webhook signatures correctly', () => {
    const payload = '{"id":"123","type":"test"}';
    const secret = 'test-secret';
    const signature = require('crypto')
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const isValid = WebhookManager.verifySignature(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it('should reject invalid signatures', () => {
    const payload = '{"id":"123","type":"test"}';
    const secret = 'test-secret';
    const invalidSignature = 'invalid-signature';

    const isValid = WebhookManager.verifySignature(payload, invalidSignature, secret);
    expect(isValid).toBe(false);
  });
});

describe('WorkflowEngine Integration', () => {
  let workflowEngine: WorkflowEngine;

  beforeAll(() => {
    workflowEngine = new WorkflowEngine();
  });

  it('should create and parse workflow definition', () => {
    const workflowDef = {
      id: 'workflow-1',
      name: 'Partner Onboarding',
      steps: [
        {
          id: 'step-1',
          type: 'connector',
          action: 'create_contact',
          connector: 'hubspot',
        },
        {
          id: 'step-2',
          type: 'template',
          action: 'send_email',
          template: 'welcome-email',
        },
      ],
    };

    const workflow = workflowEngine.parseWorkflow(workflowDef);
    expect(workflow).toBeDefined();
    expect(workflow.steps).toHaveLength(2);
  });

  it('should validate workflow dependencies', () => {
    const workflowDef = {
      id: 'workflow-2',
      name: 'Test',
      steps: [
        {
          id: 'step-1',
          type: 'connector',
          dependencies: ['non-existent'],
        },
      ],
    };

    expect(() => workflowEngine.parseWorkflow(workflowDef)).toThrow();
  });
});

/**
 * Performance Tests
 */
describe('Performance Benchmarks', () => {
  it('should compile 100 templates under 500ms', () => {
    const engine = new TemplateEngine();
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      engine.compileTemplate(`template-${i}`, 'Hello {{name}}, value is {{amount}}');
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(500);
  });

  it('should render 1000 templates from cache under 1000ms', () => {
    const engine = new TemplateEngine();
    engine.compileTemplate('benchmark', 'Test {{value}} {{name}}'  );

    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      engine.renderTemplate('benchmark', { value: i, name: 'test' });
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000);
  });
});

/**
 * Export test summary
 */
export const testSummary = {
  total_suites: 5,
  total_tests: 15,
  coverage_target: '80%',
  performance_benchmarks: 2,
};
