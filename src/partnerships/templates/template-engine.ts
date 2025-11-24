import Handlebars from 'handlebars';
import { Logger } from '../utils/logger';
import { ITemplateContext, IRenderedTemplate } from '../interfaces/template.interface';

/**
 * TemplateEngine: Enterprise-grade template rendering system
 * Supports Handlebars templating with custom helpers and security features
 */
export class TemplateEngine {
  private logger = new Logger('TemplateEngine');
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private precompiledHelpers: Map<string, Function> = new Map();

  constructor() {
    this.registerDefaultHelpers();
  }

  /**
   * Register custom Handlebars helpers for enterprise use cases
   */
  private registerDefaultHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      if (!date) return '';
      const d = new Date(date);
      if (format === 'ISO') return d.toISOString();
      if (format === 'short') return d.toLocaleDateString();
      return d.toLocaleString();
    });

    // Currency formatting helper
    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string = 'USD') => {
      if (typeof amount !== 'number') return '';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    });

    // Conditional comparison helper
    Handlebars.registerHelper('ifEquals', function(a: any, b: any, options: any) {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    // Array iteration with index
    Handlebars.registerHelper('eachWithIndex', function(array: any[], options: any) {
      let output = '';
      if (Array.isArray(array)) {
        for (let i = 0; i < array.length; i++) {
          output += options.fn(array[i], { data: { index: i, isFirst: i === 0, isLast: i === array.length - 1 } });
        }
      }
      return output;
    });

    // Pluralization helper
    Handlebars.registerHelper('pluralize', function(count: number, singular: string, plural: string) {
      return count === 1 ? singular : plural;
    });

    // String truncation helper
    Handlebars.registerHelper('truncate', function(text: string, length: number) {
      if (text && text.length > length) {
        return text.substring(0, length) + '...';
      }
      return text;
    });

    // Uppercase transformation
    Handlebars.registerHelper('uppercase', (text: string) => {
      return text ? text.toUpperCase() : '';
    });

    // Lowercase transformation
    Handlebars.registerHelper('lowercase', (text: string) => {
      return text ? text.toLowerCase() : '';
    });

    // Titlecase transformation
    Handlebars.registerHelper('titlecase', (text: string) => {
      if (!text) return '';
      return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    });

    // JSON stringify helper
    Handlebars.registerHelper('json', (obj: any) => {
      return JSON.stringify(obj, null, 2);
    });

    // Math helpers
    Handlebars.registerHelper('add', (a: number, b: number) => a + b);
    Handlebars.registerHelper('subtract', (a: number, b: number) => a - b);
    Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
    Handlebars.registerHelper('divide', (a: number, b: number) => a / b);
  }

  /**
   * Register custom user-defined helper
   */
  public registerHelper(name: string, helper: Function): void {
    try {
      Handlebars.registerHelper(name, helper as any);
      this.precompiledHelpers.set(name, helper);
      this.logger.info(`Helper registered: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to register helper ${name}`, error);
      throw error;
    }
  }

  /**
   * Compile a template string and cache it
   */
  public compileTemplate(templateId: string, templateString: string): HandlebarsTemplateDelegate {
    try {
      // Validate template syntax
      if (!this.isValidHandlebars(templateString)) {
        throw new Error(`Invalid Handlebars syntax in template: ${templateId}`);
      }

      // Check cache first
      if (this.templates.has(templateId)) {
        this.logger.debug(`Template ${templateId} loaded from cache`);
        return this.templates.get(templateId)!;
      }

      // Compile new template
      const compiled = Handlebars.compile(templateString);
      this.templates.set(templateId, compiled);
      this.logger.info(`Template ${templateId} compiled successfully`);
      return compiled;
    } catch (error) {
      this.logger.error(`Failed to compile template ${templateId}`, error);
      throw new TemplateCompilationError(`Template compilation failed: ${templateId}`, error);
    }
  }

  /**
   * Render a template with context data
   */
  public renderTemplate(templateId: string, context: ITemplateContext): IRenderedTemplate {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Sanitize context to prevent injection attacks
      const sanitizedContext = this.sanitizeContext(context);

      // Render template
      const output = template(sanitizedContext);

      this.logger.debug(`Template ${templateId} rendered successfully`);
      return {
        success: true,
        content: output,
        templateId,
        renderedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to render template ${templateId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
        renderedAt: new Date(),
      };
    }
  }

  /**
   * Render multiple templates with shared context (for batch operations)
   */
  public renderBatch(templates: Array<{ templateId: string; context: ITemplateContext }>): IRenderedTemplate[] {
    return templates.map((template) => this.renderTemplate(template.templateId, template.context));
  }

  /**
   * Render template from string directly (no caching)
   */
  public renderInline(templateString: string, context: ITemplateContext): string {
    try {
      const compiled = Handlebars.compile(templateString);
      const sanitizedContext = this.sanitizeContext(context);
      return compiled(sanitizedContext);
    } catch (error) {
      this.logger.error('Failed to render inline template', error);
      throw new TemplateRenderingError('Inline template rendering failed', error);
    }
  }

  /**
   * Validate Handlebars syntax without compilation errors
   */
  private isValidHandlebars(templateString: string): boolean {
    try {
      Handlebars.precompile(templateString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize context to prevent injection attacks
   */
  private sanitizeContext(context: ITemplateContext): ITemplateContext {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(context)) {
      // Remove dangerous keys and properties
      if (key.toLowerCase().includes('__proto__') || key.toLowerCase().includes('constructor')) {
        this.logger.warn(`Dangerous key detected and sanitized: ${key}`);
        continue;
      }
      sanitized[key] = this.sanitizeValue(value);
    }
    return sanitized;
  }

  /**
   * Recursively sanitize values in context
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Basic XSS prevention
      return value.replace(/[<>"']/g, (char) => {
        const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[char];
      });
    } else if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    } else if (typeof value === 'object' && value !== null) {
      return this.sanitizeContext(value);
    }
    return value;
  }

  /**
   * Get template cache statistics
   */
  public getCacheStats(): { totalTemplates: number; totalHelpers: number; cachedTemplateIds: string[] } {
    return {
      totalTemplates: this.templates.size,
      totalHelpers: this.precompiledHelpers.size,
      cachedTemplateIds: Array.from(this.templates.keys()),
    };
  }

  /**
   * Clear specific template from cache
   */
  public clearTemplate(templateId: string): void {
    if (this.templates.has(templateId)) {
      this.templates.delete(templateId);
      this.logger.info(`Template ${templateId} removed from cache`);
    }
  }

  /**
   * Clear all cached templates
   */
  public clearAllTemplates(): void {
    this.templates.clear();
    this.logger.info('All templates cleared from cache');
  }
}

/**
 * Custom error classes for template operations
 */
export class TemplateCompilationError extends Error {
  constructor(message: string, public originalError: any) {
    super(message);
    this.name = 'TemplateCompilationError';
  }
}

export class TemplateRenderingError extends Error {
  constructor(message: string, public originalError: any) {
    super(message);
    this.name = 'TemplateRenderingError';
  }
}

// Export singleton instance
export const templateEngine = new TemplateEngine();
