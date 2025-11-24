import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface TenantContext {
  tenantId: string;
  userId: string;
  organizationId: string;
  permissions: string[];
  features: string[];
  rateLimitQuota: number;
}

export interface TenantRequest extends Request {
  tenant?: TenantContext;
}

const tenantStore = new Map<string, TenantContext>();

export class TenantMiddleware {
  /**
   * Extract tenant from request headers or subdomain
   */
  static extractTenant(req: TenantRequest, res: Response, next: NextFunction): void {
    try {
      const tenantHeader = req.headers['x-tenant-id'] as string;
      const host = req.hostname;
      
      let tenantId: string | null = null;
      
      // Try to get tenant from header first
      if (tenantHeader) {
        tenantId = tenantHeader;
      } else {
        // Try to extract from subdomain (e.g., tenant.app.com)
        const parts = host.split('.');
        if (parts.length > 2) {
          tenantId = parts[0];
        }
      }
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID not provided' });
      }
      
      const tenantContext = tenantStore.get(tenantId) || this.createTenantContext(tenantId);
      req.tenant = tenantContext;
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Failed to extract tenant' });
    }
  }

  /**
   * Verify tenant access and permissions
   */
  static verifyTenantAccess(req: TenantRequest, res: Response, next: NextFunction): void {
    if (!req.tenant) {
      return res.status(401).json({ error: 'Tenant context not found' });
    }
    
    if (!req.tenant.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    next();
  }

  /**
   * Check tenant feature availability
   */
  static requireFeature(featureName: string) {
    return (req: TenantRequest, res: Response, next: NextFunction): void => {
      if (!req.tenant) {
        return res.status(401).json({ error: 'Tenant context not found' });
      }
      
      if (!req.tenant.features.includes(featureName)) {
        return res.status(403).json({ error: `Feature ${featureName} not available` });
      }
      
      next();
    };
  }

  /**
   * Check permissions
   */
  static requirePermission(permission: string) {
    return (req: TenantRequest, res: Response, next: NextFunction): void => {
      if (!req.tenant) {
        return res.status(401).json({ error: 'Tenant context not found' });
      }
      
      if (!req.tenant.permissions.includes(permission)) {
        return res.status(403).json({ error: `Permission ${permission} denied` });
      }
      
      next();
    };
  }

  /**
   * Isolate tenant data in queries
   */
  static isolateTenantData(req: TenantRequest, res: Response, next: NextFunction): void {
    if (!req.tenant) {
      return res.status(401).json({ error: 'Tenant context not found' });
    }
    
    // Add tenant filter to request body for database queries
    if (!req.body) req.body = {};
    req.body._tenantId = req.tenant.tenantId;
    
    next();
  }

  /**
   * Create tenant context
   */
  private static createTenantContext(tenantId: string): TenantContext {
    const context: TenantContext = {
      tenantId,
      userId: '',
      organizationId: tenantId,
      permissions: ['read', 'write'],
      features: ['analytics', 'reports', 'webhooks'],
      rateLimitQuota: 1000 // per hour
    };
    
    tenantStore.set(tenantId, context);
    return context;
  }

  /**
   * Register tenant
   */
  static registerTenant(tenantId: string, context: Partial<TenantContext>): void {
    const existingContext = tenantStore.get(tenantId);
    const merged = {
      ...existingContext,
      ...context,
      tenantId
    } as TenantContext;
    
    tenantStore.set(tenantId, merged);
  }

  /**
   * Get all tenants
   */
  static getAllTenants(): Map<string, TenantContext> {
    return new Map(tenantStore);
  }

  /**
   * Delete tenant
   */
  static deleteTenant(tenantId: string): boolean {
    return tenantStore.delete(tenantId);
  }
}

export default TenantMiddleware;
