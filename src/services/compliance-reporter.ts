import { Logger } from '../utils/logger';
import { AuditLogEntry } from './audit-logger';

export enum ComplianceFramework {
  GDPR = 'GDPR',
  CCPA = 'CCPA',
  HIPAA = 'HIPAA',
  SOC_2_TYPE_II = 'SOC_2_TYPE_II',
  PCI_DSS = 'PCI_DSS',
  ISO_27001 = 'ISO_27001'
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  period: { startDate: Date; endDate: Date };
  totalAuditLogs: number;
  complianceScore: number;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING';
  findings: ComplianceFinding[];
  recommendations: string[];
  generatedAt: Date;
}

export interface ComplianceFinding {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
  affectedRecords: number;
  remediation: string;
}

export interface RetentionPolicy {
  framework: ComplianceFramework;
  minimumDaysRequired: number;
  archiveDays?: number;
  deleteAfterDays?: number;
}

export class ComplianceReporter {
  private logger: Logger;
  private db: any;
  private retentionPolicies: Map<ComplianceFramework, RetentionPolicy>;

  constructor(database: any) {
    this.logger = Logger.getInstance();
    this.db = database;
    this.initializeRetentionPolicies();
  }

  private initializeRetentionPolicies(): void {
    this.retentionPolicies = new Map([
      [ComplianceFramework.GDPR, { framework: ComplianceFramework.GDPR, minimumDaysRequired: 90, archiveDays: 365, deleteAfterDays: 2555 }],
      [ComplianceFramework.CCPA, { framework: ComplianceFramework.CCPA, minimumDaysRequired: 90, deleteAfterDays: 2555 }],
      [ComplianceFramework.HIPAA, { framework: ComplianceFramework.HIPAA, minimumDaysRequired: 365, archiveDays: 730, deleteAfterDays: 2555 }],
      [ComplianceFramework.SOC_2_TYPE_II, { framework: ComplianceFramework.SOC_2_TYPE_II, minimumDaysRequired: 365, archiveDays: 730 }],
      [ComplianceFramework.PCI_DSS, { framework: ComplianceFramework.PCI_DSS, minimumDaysRequired: 365, archiveDays: 730 }],
      [ComplianceFramework.ISO_27001, { framework: ComplianceFramework.ISO_27001, minimumDaysRequired: 90, archiveDays: 730 }]
    ]);
  }

  public async generateReport(framework: ComplianceFramework, startDate: Date, endDate: Date): Promise<ComplianceReport> {
    try {
      const logs = await this.db.getAuditLogsByDateRange(startDate, endDate);
      const findings: ComplianceFinding[] = [];
      let complianceScore = 100;

      switch (framework) {
        case ComplianceFramework.GDPR:
          findings.push(...await this.checkGDPRCompliance(logs));
          break;
        case ComplianceFramework.CCPA:
          findings.push(...await this.checkCCPACompliance(logs));
          break;
        case ComplianceFramework.HIPAA:
          findings.push(...await this.checkHIPAACompliance(logs));
          break;
        case ComplianceFramework.SOC_2_TYPE_II:
          findings.push(...await this.checkSOC2Compliance(logs));
          break;
      }

      const retentionPolicy = this.retentionPolicies.get(framework);
      if (retentionPolicy) {
        const retentionDays = Math.floor((Date.now() - Math.min(...logs.map(l => l.timestamp.getTime()))) / (1000 * 60 * 60 * 24));
        if (retentionDays < retentionPolicy.minimumDaysRequired) {
          findings.push({
            severity: 'HIGH',
            category: 'Retention Policy',
            description: `Retention period (${retentionDays} days) below minimum (${retentionPolicy.minimumDaysRequired} days)`,
            affectedRecords: logs.length,
            remediation: `Maintain audit logs for at least ${retentionPolicy.minimumDaysRequired} days`
          });
          complianceScore -= 15;
        }
      }

      findings.forEach(finding => {
        switch (finding.severity) {
          case 'CRITICAL': complianceScore -= 20; break;
          case 'HIGH': complianceScore -= 10; break;
          case 'MEDIUM': complianceScore -= 5; break;
          case 'LOW': complianceScore -= 1; break;
        }
      });

      complianceScore = Math.max(0, Math.min(100, complianceScore));

      return {
        framework,
        period: { startDate, endDate },
        totalAuditLogs: logs.length,
        complianceScore,
        status: complianceScore >= 90 ? 'COMPLIANT' : complianceScore >= 70 ? 'WARNING' : 'NON_COMPLIANT',
        findings,
        recommendations: this.generateRecommendations(findings),
        generatedAt: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to generate compliance report', error);
      throw error;
    }
  }

  private async checkGDPRCompliance(logs: AuditLogEntry[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];
    const unauthorizedAccess = logs.filter(l => l.result === 'FAILURE');
    if (unauthorizedAccess.length > 10) {
      findings.push({ severity: 'HIGH', category: 'GDPR Article 33', description: `${unauthorizedAccess.length} unauthorized attempts. Breach notification required.`, affectedRecords: unauthorizedAccess.length, remediation: 'Notify authorities within 72 hours' });
    }
    const exportCount = logs.filter(l => l.eventType === 'DATA_EXPORT').length;
    const deleteCount = logs.filter(l => l.eventType === 'DATA_DELETE').length;
    if (deleteCount === 0 && exportCount > 5) {
      findings.push({ severity: 'MEDIUM', category: 'GDPR Article 5', description: 'Ensure data minimization principle', affectedRecords: exportCount, remediation: 'Implement regular data deletion/pseudonymization' });
    }
    return findings;
  }

  private async checkCCPACompliance(logs: AuditLogEntry[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];
    const accessRequests = logs.filter(l => l.action.includes('access') || l.action.includes('export'));
    if (accessRequests.length === 0 && logs.length > 100) {
      findings.push({ severity: 'MEDIUM', category: 'CCPA Consumer Rights', description: 'No data access/export requests logged', affectedRecords: logs.length, remediation: 'Track consumer requests for data access' });
    }
    return findings;
  }

  private async checkHIPAACompliance(logs: AuditLogEntry[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];
    const ephiLogs = logs.filter(l => l.dataClassification === 'RESTRICTED');
    if (ephiLogs.length === 0 && logs.length > 50) {
      findings.push({ severity: 'HIGH', category: 'HIPAA Audit Controls', description: 'No ePHI access logs found', affectedRecords: logs.length, remediation: 'Implement comprehensive ePHI access logging' });
    }
    const unencrypted = logs.filter(l => !l.encryptionAlgorithm);
    if (unencrypted.length > 0) {
      findings.push({ severity: 'CRITICAL', category: 'HIPAA Encryption', description: `${unencrypted.length} logs without encryption`, affectedRecords: unencrypted.length, remediation: 'Encrypt all ePHI at rest and in transit' });
    }
    return findings;
  }

  private async checkSOC2Compliance(logs: AuditLogEntry[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];
    const failedLogins = logs.filter(l => l.eventType === 'AUTH_LOGIN_FAILURE');
    if (failedLogins.length > 20) {
      findings.push({ severity: 'HIGH', category: 'SOC2 CC7.2', description: `${failedLogins.length} unauthorized attempts`, affectedRecords: failedLogins.length, remediation: 'Implement multi-factor authentication' });
    }
    return findings;
  }

  private generateRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations: string[] = [];
    if (findings.some(f => f.severity === 'CRITICAL')) {
      recommendations.push('Address critical findings immediately');
    }
    if (!recommendations.length) {
      recommendations.push('Maintain current compliance controls and schedule quarterly audits');
    }
    return recommendations;
  }

  public getRetentionPolicy(framework: ComplianceFramework): RetentionPolicy | undefined {
    return this.retentionPolicies.get(framework);
  }
}
