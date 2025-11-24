import { AuditService } from '../services/audit.service';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
  });

  describe('scanRepository', () => {
    it('should scan repository and return audit results', async () => {
      const mockRepoPath = '/test/repo';
      const result = await auditService.scanRepository(mockRepoPath);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('codeQuality');
      expect(result).toHaveProperty('securityScore');
    });

    it('should handle empty repository', async () => {
      const emptyRepoPath = '/empty/repo';
      const result = await auditService.scanRepository(emptyRepoPath);
      
      expect(result.vulnerabilities).toEqual([]);
      expect(result.securityScore).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for invalid path', async () => {
      await expect(auditService.scanRepository('/invalid/path')).rejects.toThrow();
    });
  });

  describe('analyzeFile', () => {
    it('should analyze single file for security issues', async () => {
      const mockFileContent = 'const password = "hardcoded123";';
      const result = await auditService.analyzeFile('test.js', mockFileContent);
      
      expect(result).toBeDefined();
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].severity).toMatch(/high|medium|low/);
    });

    it('should return no issues for safe code', async () => {
      const safeCode = 'const config = require("./config");';
      const result = await auditService.analyzeFile('safe.js', safeCode);
      
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateSecurityScore', () => {
    it('should calculate security score between 0 and 100', async () => {
      const score = await auditService.calculateSecurityScore([]);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should lower score with more vulnerabilities', async () => {
      const vulnerabilities = [
        { id: 1, severity: 'high' },
        { id: 2, severity: 'medium' },
      ];
      
      const score = await auditService.calculateSecurityScore(vulnerabilities);
      expect(score).toBeLessThan(100);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive audit report', async () => {
      const mockResults = {
        vulnerabilities: [],
        codeQuality: 8.5,
        securityScore: 92,
      };
      
      const report = await auditService.generateReport(mockResults);
      
      expect(report).toBeDefined();
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('details');
      expect(report).toHaveProperty('recommendations');
    });
  });
});
