// Data models and TypeScript interfaces

export interface AuditReport {
  id: string;
  timestamp: Date;
  repository: string;
  vulnerabilities: Vulnerability[];
  complianceStatus: ComplianceStatus;
}

export interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  remediation: string;
}

export interface ComplianceStatus {
  framework: string;
  status: 'compliant' | 'non-compliant' | 'pending';
  lastAudited: Date;
}

export interface GovernanceRecord {
  id: string;
  type: string;
  data: any;
  signature: string;
  timestamp: Date;
}
