import { Logger } from '../utils/logger';
import { AuditLogEntry, AuditEventType } from './audit-logger';

export enum AnomalyType {
  BRUTE_FORCE_LOGIN = 'BRUTE_FORCE_LOGIN',
  UNUSUAL_TIME_ACCESS = 'UNUSUAL_TIME_ACCESS',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  BULK_DATA_EXPORT = 'BULK_DATA_EXPORT',
  GEOGRAPHIC_ANOMALY = 'GEOGRAPHIC_ANOMALY',
  DEVICE_FINGERPRINT_CHANGE = 'DEVICE_FINGERPRINT_CHANGE',
  PERMISSION_ABUSE = 'PERMISSION_ABUSE',
  PATTERN_DEVIATION = 'PATTERN_DEVIATION'
}

export interface AnomalyScore {
  userId: string;
  anomalyType: AnomalyType;
  score: number; // 0-100
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number; // 0-1
  indicators: string[];
  timestamp: Date;
  recommendedAction: 'MONITOR' | 'ALERT' | 'BLOCK' | 'REQUIRE_MFA';
}

export interface UserBehaviorProfile {
  userId: string;
  averageLoginHour: number;
  commonCountries: Set<string>;
  commonDevices: Set<string>;
  typicalAccessPatterns: Map<string, number>; // action -> frequency
  lastUpdated: Date;
  riskScore: number;
}

export class AnomalyDetectionEngine {
  private logger: Logger;
  private db: any;
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  private anomalyThresholds = {
    bruteForceAttempts: 5, // Failed logins in 15 min
    bulkExportRecords: 10000, // Records in single export
    privilegeEscalationTime: 300000, // 5 minutes
    geographicDistanceKm: 900 // Impossible travel (900km/hr)
  };

  constructor(database: any) {
    this.logger = Logger.getInstance();
    this.db = database;
    this.initializeProfiles();
  }

  private async initializeProfiles(): Promise<void> {
    try {
      const profiles = await this.db.getUserBehaviorProfiles();
      for (const profile of profiles) {
        this.userProfiles.set(profile.userId, profile);
      }
    } catch (error) {
      this.logger.error('Failed to initialize behavior profiles', error);
    }
  }

  public async analyzeAuditLog(entry: AuditLogEntry): Promise<AnomalyScore | null> {
    try {
      let anomaly: AnomalyScore | null = null;

      // Check for brute force attacks
      if (entry.eventType === AuditEventType.LOGIN_FAILURE) {
        anomaly = await this.detectBruteForce(entry);
      }

      // Check for bulk data exports
      if (entry.eventType === AuditEventType.DATA_EXPORT && entry.affectedRecords) {
        anomaly = await this.detectBulkExport(entry);
      }

      // Check for permission escalation
      if (entry.eventType === AuditEventType.PERMISSION_GRANT) {
        anomaly = await this.detectPrivilegeEscalation(entry);
      }

      // Check for geographic anomalies
      if (entry.eventType === AuditEventType.LOGIN_SUCCESS) {
        anomaly = await this.detectGeographicAnomaly(entry);
      }

      // Check for pattern deviations
      if (entry.eventType === AuditEventType.DATA_READ) {
        anomaly = await this.detectPatternDeviation(entry);
      }

      if (anomaly) {
        await this.recordAnomaly(anomaly);
        if (anomaly.severity === 'CRITICAL') {
          await this.triggerAlert(anomaly, entry);
        }
      }

      return anomaly;
    } catch (error) {
      this.logger.error('Anomaly detection error', error);
      return null;
    }
  }

  private async detectBruteForce(entry: AuditLogEntry): Promise<AnomalyScore | null> {
    const userId = entry.userId;
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60000);

    const failedAttempts = await this.db.countFailedLogins(
      userId,
      fifteenMinutesAgo
    );

    if (failedAttempts >= this.anomalyThresholds.bruteForceAttempts) {
      return {
        userId,
        anomalyType: AnomalyType.BRUTE_FORCE_LOGIN,
        score: Math.min(100, failedAttempts * 15),
        severity: failedAttempts > 10 ? 'CRITICAL' : 'HIGH',
        confidence: 0.95,
        indicators: [`${failedAttempts} failed login attempts in 15 minutes`],
        timestamp: new Date(),
        recommendedAction: 'REQUIRE_MFA'
      };
    }

    return null;
  }

  private async detectBulkExport(entry: AuditLogEntry): Promise<AnomalyScore | null> {
    if (!entry.affectedRecords || entry.affectedRecords < this.anomalyThresholds.bulkExportRecords) {
      return null;
    }

    const profile = this.userProfiles.get(entry.userId);
    const isAnomalous = !profile || 
      !profile.typicalAccessPatterns.has('DATA_EXPORT') ||
      profile.typicalAccessPatterns.get('DATA_EXPORT')! < entry.affectedRecords / 100;

    if (isAnomalous) {
      return {
        userId: entry.userId,
        anomalyType: AnomalyType.BULK_DATA_EXPORT,
        score: Math.min(100, (entry.affectedRecords / 50000) * 100),
        severity: 'HIGH',
        confidence: 0.85,
        indicators: [
          `Bulk export of ${entry.affectedRecords} records`,
          'Significantly above user baseline'
        ],
        timestamp: new Date(),
        recommendedAction: 'ALERT'
      };
    }

    return null;
  }

  private async detectPrivilegeEscalation(entry: AuditLogEntry): Promise<AnomalyScore | null> {
    const timeSinceLastGrant = await this.db.getTimeSinceLastPermissionGrant(entry.userId);

    if (timeSinceLastGrant < this.anomalyThresholds.privilegeEscalationTime) {
      return {
        userId: entry.userId,
        anomalyType: AnomalyType.PRIVILEGE_ESCALATION,
        score: 85,
        severity: 'HIGH',
        confidence: 0.9,
        indicators: [
          `Multiple permission grants within 5 minutes`,
          'Possible privilege escalation attempt'
        ],
        timestamp: new Date(),
        recommendedAction: 'ALERT'
      };
    }

    return null;
  }

  private async detectGeographicAnomaly(entry: AuditLogEntry): Promise<AnomalyScore | null> {
    const profile = this.userProfiles.get(entry.userId);
    if (!profile || profile.commonCountries.size === 0) {
      return null; // No baseline data
    }

    const currentCountry = await this.getCountryFromIP(entry.ipAddress);
    const isNewCountry = !profile.commonCountries.has(currentCountry);

    if (isNewCountry) {
      return {
        userId: entry.userId,
        anomalyType: AnomalyType.GEOGRAPHIC_ANOMALY,
        score: 70,
        severity: 'MEDIUM',
        confidence: 0.8,
        indicators: [
          `Login from new geographic location: ${currentCountry}`,
          `User typically logs in from: ${Array.from(profile.commonCountries).join(', ')}`
        ],
        timestamp: new Date(),
        recommendedAction: 'REQUIRE_MFA'
      };
    }

    return null;
  }

  private async detectPatternDeviation(entry: AuditLogEntry): Promise<AnomalyScore | null> {
    const profile = this.userProfiles.get(entry.userId);
    if (!profile || profile.typicalAccessPatterns.size === 0) {
      return null;
    }

    const resource = entry.resource;
    const typicalFreq = profile.typicalAccessPatterns.get(resource) || 0;
    const currentHour = new Date().getHours();
    const deviationFromTime = Math.abs(currentHour - profile.averageLoginHour);

    if (deviationFromTime > 6 && typicalFreq === 0) {
      return {
        userId: entry.userId,
        anomalyType: AnomalyType.PATTERN_DEVIATION,
        score: 60,
        severity: 'LOW',
        confidence: 0.7,
        indicators: [
          `Access at unusual hour: ${currentHour}:00 (typical: ${profile.averageLoginHour}:00)`,
          `New resource access: ${resource}`
        ],
        timestamp: new Date(),
        recommendedAction: 'MONITOR'
      };
    }

    return null;
  }

  private async getCountryFromIP(ipAddress: string): Promise<string> {
    try {
      return await this.db.lookupGeoIP(ipAddress);
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  private async recordAnomaly(anomaly: AnomalyScore): Promise<void> {
    try {
      await this.db.insertAnomaly({
        ...anomaly,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to record anomaly', error);
    }
  }

  private async triggerAlert(anomaly: AnomalyScore, entry: AuditLogEntry): Promise<void> {
    try {
      await this.db.sendSecurityAlert({
        userId: anomaly.userId,
        anomalyType: anomaly.anomalyType,
        score: anomaly.score,
        severity: anomaly.severity,
        entry: entry,
        timestamp: new Date()
      });

      this.logger.warn(`CRITICAL ANOMALY DETECTED: ${anomaly.anomalyType} for user ${anomaly.userId}`);
    } catch (error) {
      this.logger.error('Failed to send security alert', error);
    }
  }

  public async updateUserProfile(userId: string, entry: AuditLogEntry): Promise<void> {
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        averageLoginHour: new Date().getHours(),
        commonCountries: new Set(),
        commonDevices: new Set(),
        typicalAccessPatterns: new Map(),
        lastUpdated: new Date(),
        riskScore: 0
      };
    }

    // Update patterns
    const currentFreq = profile.typicalAccessPatterns.get(entry.resource) || 0;
    profile.typicalAccessPatterns.set(entry.resource, currentFreq + 1);

    // Update device fingerprint
    if (entry.userAgent) {
      profile.commonDevices.add(entry.userAgent);
    }

    // Update geography
    if (entry.ipAddress) {
      const country = await this.getCountryFromIP(entry.ipAddress);
      profile.commonCountries.add(country);
    }

    profile.lastUpdated = new Date();
    this.userProfiles.set(userId, profile);

    // Persist to database
    try {
      await this.db.updateUserProfile(profile);
    } catch (error) {
      this.logger.error('Failed to persist user profile', error);
    }
  }

  public getAnomalyStats(): any {
    return {
      totalProfiles: this.userProfiles.size,
      averageRiskScore: Array.from(this.userProfiles.values())
        .reduce((sum, p) => sum + p.riskScore, 0) / this.userProfiles.size || 0
    };
  }
}
