import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

// ============================================================================
// AUDIT LOG TYPES & INTERFACES
// ============================================================================

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILURE = 'AUTH_LOGIN_FAILURE',
  LOGOUT = 'AUTH_LOGOUT',
  PASSWORD_CHANGE = 'AUTH_PASSWORD_CHANGE',
  MFA_ENABLED = 'AUTH_MFA_ENABLED',
  MFA_DISABLED = 'AUTH_MFA_DISABLED',

  // Data access events
  DATA_READ = 'DATA_READ',
  DATA_CREATE = 'DATA_CREATE',
  DATA_UPDATE = 'DATA_UPDATE',
  DATA_DELETE = 'DATA_DELETE',
  DATA_EXPORT = 'DATA_EXPORT',

  // Permission events
  PERMISSION_GRANT = 'PERM_GRANT',
  PERMISSION_REVOKE = 'PERM_REVOKE',
  ROLE_ASSIGN = 'ROLE_ASSIGN',
  ROLE_REMOVE = 'ROLE_REMOVE',

  // Security events
  SECURITY_ALERT = 'SEC_ALERT',
  ANOMALY_DETECTED = 'SEC_ANOMALY',
  THREAT_BLOCKED = 'SEC_THREAT_BLOCKED',

  // System events
  CONFIG_CHANGE = 'SYS_CONFIG_CHANGE',
  API_KEY_GENERATED = 'SYS_API_KEY_CREATED',
  API_KEY_REVOKED = 'SYS_API_KEY_REVOKED'
}

export enum SeverityLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  ALERT = 'ALERT'
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: SeverityLevel;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress: string;
  userAgent: string;
  statusCode: number;
  endpoint: string;
  method: string;
  requestId: string;
  responseTime: number;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  errorMessage?: string;
  affectedRecords?: number;
  dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  complianceRelevant: boolean;
  encryptionAlgorithm?: string;
  hash?: string;
}

export class AuditLogger {
  private logger: Logger;
  private db: any;
  private pqcEnabled: boolean = false;
  private batchSize: number = 100;
  private batchBuffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timer | null = null;

  constructor(database: any, enablePQC: boolean = false) {
    this.logger = Logger.getInstance();
    this.db = database;
    this.pqcEnabled = enablePQC;
    this.startBatchProcessor();
  }

  public async logAPICall(
    req: Request,
    eventType: AuditEventType,
    severity: SeverityLevel = SeverityLevel.INFO,
    metadata?: Partial<AuditLogEntry>
  ): Promise<void> {
    try {
      const entry = this.createAuditEntry(req, eventType, severity, metadata);
      await this.addToBatch(entry);
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
    }
  }

  public async logAuthFailure(
    req: Request,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.logAPICall(req, AuditEventType.LOGIN_FAILURE, SeverityLevel.WARNING, {
      userId,
      action: `Failed login: ${reason}`,
      resource: 'Authentication',
      result: 'FAILURE',
      errorMessage: reason,
      complianceRelevant: true,
      dataClassification: 'RESTRICTED'
    });
  }

  public async logDataAccess(
    req: Request,
    userId: string,
    resourceId: string,
    action: string
  ): Promise<void> {
    await this.logAPICall(req, AuditEventType.DATA_READ, SeverityLevel.INFO, {
      userId,
      action: `Data accessed: ${action}`,
      resource: req.path,
      resourceId,
      complianceRelevant: true,
      dataClassification: 'CONFIDENTIAL'
    });
  }

  public async logDataModification(
    req: Request,
    userId: string,
    resourceId: string,
    oldValue: any,
    newValue: any
  ): Promise<void> {
    await this.logAPICall(req, AuditEventType.DATA_UPDATE, SeverityLevel.WARNING, {
      userId,
      action: `Data modified`,
      resource: req.path,
      resourceId,
      oldValue,
      newValue,
      complianceRelevant: true,
      dataClassification: 'RESTRICTED'
    });
  }

  public async logPermissionChange(
    req: Request,
    userId: string,
    targetUserId: string,
    permission: string,
    granted: boolean
  ): Promise<void> {
    const eventType = granted ? AuditEventType.PERMISSION_GRANT : AuditEventType.PERMISSION_REVOKE;
    await this.logAPICall(req, eventType, SeverityLevel.WARNING, {
      userId,
      action: `Permission ${granted ? 'granted' : 'revoked'}: ${permission}`,
      resource: 'User Permissions',
      resourceId: targetUserId,
      complianceRelevant: true
    });
  }

  public async logSecurityAlert(
    req: Request,
    userId: string,
    alertType: string,
    details: any
  ): Promise<void> {
    await this.logAPICall(req, AuditEventType.SECURITY_ALERT, SeverityLevel.CRITICAL, {
      userId,
      action: `Security alert: ${alertType}`,
      resource: 'Security',
      errorMessage: JSON.stringify(details),
      complianceRelevant: true
    });
  }

  private createAuditEntry(
    req: Request,
    eventType: AuditEventType,
    severity: SeverityLevel,
    metadata?: Partial<AuditLogEntry>
  ): AuditLogEntry {
    const userId = (req as any).user?.id || 'ANONYMOUS';
    const userEmail = (req as any).user?.email || 'unknown@system.local';
    const requestId = req.id || crypto.randomUUID();
    const startTime = (req as any).startTime || Date.now();

    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType,
      severity,
      userId,
      userEmail,
      action: 'API Call',
      resource: req.path,
      ipAddress: this.extractIPAddress(req),
      userAgent: req.get('user-agent') || 'unknown',
      statusCode: 200,
      endpoint: req.path,
      method: req.method,
      requestId,
      responseTime: Date.now() - startTime,
      result: 'SUCCESS',
      complianceRelevant: false,
      dataClassification: 'INTERNAL',
      encryptionAlgorithm: this.pqcEnabled ? 'ML-KEM-1024' : undefined,
      ...metadata
    };

    entry.hash = this.generateLogHash(entry);
    return entry;
  }

  private extractIPAddress(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (req.connection as any).remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  private generateLogHash(entry: Partial<AuditLogEntry>): string {
    const content = JSON.stringify({
      timestamp: entry.timestamp,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async addToBatch(entry: AuditLogEntry): Promise<void> {
    this.batchBuffer.push(entry);
    if (this.batchBuffer.length >= this.batchSize) {
      await this.flushBatch();
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;
    const batch = [...this.batchBuffer];
    this.batchBuffer = [];
    try {
      await this.db.insertAuditLogs(batch);
    } catch (error) {
      this.logger.error('Audit flush failed', error);
      this.batchBuffer.unshift(...batch);
    }
  }

  private startBatchProcessor(): void {
    this.flushInterval = setInterval(() => {
      this.flushBatch().catch(err => this.logger.error('Batch error', err));
    }, 30000);
  }

  public async queryLogs(
    userId?: string,
    eventType?: AuditEventType,
    limit: number = 1000
  ): Promise<AuditLogEntry[]> {
    try {
      return await this.db.queryAuditLogs({ userId, eventType, limit });
    } catch (error) {
      this.logger.error('Query failed', error);
      return [];
    }
  }

  public async getGDPRDataExport(userId: string): Promise<AuditLogEntry[]> {
    return this.queryLogs(userId, undefined, 10000);
  }

  public async deleteUserDataForGDPR(userId: string): Promise<boolean> {
    try {
      await this.db.pseudonymizeUserLogs(userId);
      return true;
    } catch (error) {
      return false;
    }
  }

  public destroy(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flushBatch().catch(err => this.logger.error('Final flush', err));
  }
}

export function createAuditMiddleware(auditLogger: AuditLogger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    (req as any).startTime = Date.now();
    (req as any).id = crypto.randomUUID();
    next();
  };
}
