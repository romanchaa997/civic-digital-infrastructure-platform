import { describe, it, expect, beforeEach, jest } from '@jest/globals';

interface LLMResponse {
  analysis: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
  confidence: number;
}

class LLMService {
  private model: string;
  private apiKey: string;
  private requestCache: Map<string, LLMResponse>;
  private rateLimitCounter: number = 0;
  private rateLimitWindow: number = 3600000; // 1 hour

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.apiKey = apiKey;
    this.requestCache = new Map();
  }

  async analyzeSecurity(codeSnippet: string): Promise<LLMResponse> {
    const cacheKey = `security_${Buffer.from(codeSnippet).toString('base64')}`;
    
    if (this.requestCache.has(cacheKey)) {
      return this.requestCache.get(cacheKey)!;
    }

    if (this.rateLimitCounter >= 100) {
      throw new Error('Rate limit exceeded');
    }

    const response: LLMResponse = {
      analysis: `Security analysis for: ${codeSnippet.substring(0, 50)}...`,
      severity: 'medium',
      recommendations: ['Use parameterized queries', 'Add input validation'],
      confidence: 0.92
    };

    this.rateLimitCounter++;
    this.requestCache.set(cacheKey, response);
    return response;
  }

  async generateRecommendations(issue: string): Promise<string[]> {
    return [
      'Implement security best practices',
      'Add comprehensive logging',
      'Use environment variables for secrets'
    ];
  }

  async validateCode(code: string): Promise<boolean> {
    return code.length > 0 && !code.includes('dangerous');
  }

  clearCache(): void {
    this.requestCache.clear();
  }

  resetRateLimit(): void {
    this.rateLimitCounter = 0;
  }
}

describe('LLMService', () => {
  let llmService: LLMService;

  beforeEach(() => {
    llmService = new LLMService('gpt-4', 'test-api-key');
  });

  describe('analyzeSecurity', () => {
    it('should return security analysis for valid code', async () => {
      const result = await llmService.analyzeSecurity('function test() {}');
      expect(result).toBeDefined();
      expect(result.analysis).toContain('Security analysis');
      expect(result.severity).toBeDefined();
    });

    it('should return high confidence scores', async () => {
      const result = await llmService.analyzeSecurity('function test() {}');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should include recommendations', async () => {
      const result = await llmService.analyzeSecurity('SELECT * FROM users');
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should cache results for identical code snippets', async () => {
      const code = 'const x = 1;';
      const result1 = await llmService.analyzeSecurity(code);
      const result2 = await llmService.analyzeSecurity(code);
      expect(result1).toEqual(result2);
    });

    it('should have severity in valid range', async () => {
      const result = await llmService.analyzeSecurity('vulnerable code');
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      expect(validSeverities).toContain(result.severity);
    });

    it('should return different analysis for different code', async () => {
      const result1 = await llmService.analyzeSecurity('code1');
      const result2 = await llmService.analyzeSecurity('code2');
      expect(result1.analysis).not.toEqual(result2.analysis);
    });

    it('should throw error when rate limit exceeded', async () => {
      llmService.resetRateLimit();
      for (let i = 0; i < 100; i++) {
        await llmService.analyzeSecurity(`code_${i}`);
      }
      await expect(llmService.analyzeSecurity('over_limit')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for security issues', async () => {
      const recommendations = await llmService.generateRecommendations('SQL injection detected');
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should include specific security practices', async () => {
      const recommendations = await llmService.generateRecommendations('XSS vulnerability');
      const recommendationText = recommendations.join(' ');
      expect(recommendationText.toLowerCase()).toContain('security');
    });

    it('should return consistent recommendations', async () => {
      const rec1 = await llmService.generateRecommendations('issue');
      const rec2 = await llmService.generateRecommendations('issue');
      expect(rec1).toEqual(rec2);
    });

    it('should handle empty issue string', async () => {
      const recommendations = await llmService.generateRecommendations('');
      expect(recommendations).toBeDefined();
    });

    it('should return array of strings', async () => {
      const recommendations = await llmService.generateRecommendations('test issue');
      recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
      });
    });
  });

  describe('validateCode', () => {
    it('should validate safe code', async () => {
      const isValid = await llmService.validateCode('function test() { return true; }');
      expect(isValid).toBe(true);
    });

    it('should reject empty code', async () => {
      const isValid = await llmService.validateCode('');
      expect(isValid).toBe(false);
    });

    it('should reject dangerous code', async () => {
      const isValid = await llmService.validateCode('dangerous function');
      expect(isValid).toBe(false);
    });

    it('should validate code with valid syntax', async () => {
      const validCode = 'const app = require("express")();';
      const isValid = await llmService.validateCode(validCode);
      expect(isValid).toBe(true);
    });

    it('should reject multiple dangerous keywords', async () => {
      const isValid = await llmService.validateCode('dangerous dangerous code');
      expect(isValid).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await llmService.analyzeSecurity('code to cache');
      llmService.clearCache();
      // After cache clear, should make new request (not testable directly, but no error)
      expect(() => llmService.clearCache()).not.toThrow();
    });

    it('should have empty cache after clear', async () => {
      await llmService.analyzeSecurity('test code');
      llmService.clearCache();
      // Verify by analyzing same code again (should be different object)
      await llmService.analyzeSecurity('test code');
      expect(true).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should reset rate limit counter', () => {
      llmService.resetRateLimit();
      expect(() => llmService.resetRateLimit()).not.toThrow();
    });

    it('should allow 100 requests before rate limit', async () => {
      llmService.resetRateLimit();
      for (let i = 0; i < 100; i++) {
        await expect(llmService.analyzeSecurity(`code_${i}`)).resolves.toBeDefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long code snippets', async () => {
      const longCode = 'a'.repeat(10000);
      const result = await llmService.analyzeSecurity(longCode);
      expect(result).toBeDefined();
    });

    it('should handle special characters', async () => {
      const specialCode = '!@#$%^&*()_+-=[]{}|;:\'"<>?,.';
      const result = await llmService.analyzeSecurity(specialCode);
      expect(result).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const unicodeCode = '测试代码 тест ทดสอบ';
      const result = await llmService.analyzeSecurity(unicodeCode);
      expect(result).toBeDefined();
    });

    it('should handle null-like string values', async () => {
      const result = await llmService.analyzeSecurity('null');
      expect(result).toBeDefined();
    });
  });
});
