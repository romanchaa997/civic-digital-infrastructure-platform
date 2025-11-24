import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import archiver from 'archiver';
import extract from 'extract-zip';

// Phase 4: Multi-file Repository Audit Service

export interface AuditFile {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  checksum?: string;
}

export interface AuditReport {
  projectName: string;
  timestamp: string;
  totalFiles: number;
  scanDuration: number;
  vulnerabilitiesFound: number;
  criticalIssues: number;
  warnings: number;
  filesList: AuditFile[];
  sasResults?: Record<string, unknown>;
}

export class AuditService {
  private uploadDir: string;
  private extractDir: string;

  constructor(uploadDir: string = './uploads', extractDir: string = './extracted') {
    this.uploadDir = uploadDir;
    this.extractDir = extractDir;
  }

  /**
   * Extract ZIP file uploaded by user
   */
  async extractRepositoryZip(zipPath: string): Promise<string> {
    const extractionPath = path.join(this.extractDir, `repo-${Date.now()}`);
    
    try {
      await extract(zipPath, { dir: extractionPath });
      return extractionPath;
    } catch (error) {
      throw new Error(`ZIP extraction failed: ${error}`);
    }
  }

  /**
   * Scan repository for files and generate file list
   */
  async scanRepository(repoPath: string): Promise<AuditFile[]> {
    const files: AuditFile[] = [];
    
    try {
      const walkDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue; // Skip hidden files
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(repoPath, fullPath);
          
          if (entry.isDirectory()) {
            files.push({
              name: entry.name,
              path: relativePath,
              size: 0,
              type: 'directory'
            });
            walkDir(fullPath);
          } else {
            const stats = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              path: relativePath,
              size: stats.size,
              type: 'file'
            });
          }
        }
      };
      
      walkDir(repoPath);
      return files;
    } catch (error) {
      throw new Error(`Repository scan failed: ${error}`);
    }
  }

  /**
   * Run SAST (Static Application Security Testing) analysis
   */
  async runSecurityAnalysis(repoPath: string): Promise<Record<string, unknown>> {
    try {
      // Run ESLint
      const eslintResult = this.runESLint(repoPath);
      
      // Run TypeScript compiler
      const tsResult = this.runTypeScript(repoPath);
      
      // Run SonarQube or CodeQL if configured
      const codeqlResult = this.runCodeQL(repoPath);
      
      return {
        eslint: eslintResult,
        typescript: tsResult,
        codeql: codeqlResult
      };
    } catch (error) {
      throw new Error(`Security analysis failed: ${error}`);
    }
  }

  private runESLint(repoPath: string): Record<string, unknown> {
    try {
      const result = execSync(`eslint ${repoPath} --format json`, { encoding: 'utf-8' });
      return JSON.parse(result);
    } catch (error) {
      return { error: 'ESLint execution failed' };
    }
  }

  private runTypeScript(repoPath: string): Record<string, unknown> {
    try {
      execSync(`tsc --noEmit`, { cwd: repoPath });
      return { status: 'success', issuesFound: 0 };
    } catch (error) {
      return { status: 'error', message: 'TypeScript compilation failed' };
    }
  }

  private runCodeQL(repoPath: string): Record<string, unknown> {
    // Placeholder for CodeQL integration
    return { status: 'pending', message: 'CodeQL analysis not configured' };
  }

  /**
   * Generate comprehensive audit report
   */
  async generateAuditReport(
    projectName: string,
    files: AuditFile[],
    scanResults: Record<string, unknown>,
    startTime: number
  ): Promise<AuditReport> {
    const endTime = Date.now();
    const scanDuration = (endTime - startTime) / 1000; // seconds

    return {
      projectName,
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      scanDuration,
      vulnerabilitiesFound: 0, // TODO: Parse from scanResults
      criticalIssues: 0,
      warnings: 0,
      filesList: files.slice(0, 100), // Limit to first 100 files for report
      sasResults: scanResults
    };
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(extractionPath: string): Promise<void> {
    try {
      if (fs.existsSync(extractionPath)) {
        fs.rmSync(extractionPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Cleanup failed: ${error}`);
    }
  }
}

export default new AuditService();
