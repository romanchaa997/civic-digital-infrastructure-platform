/**
 * Phase 4: LLM Integration Service
 * OpenAI-powered code analysis for "Ask the Auditor" feature
 */

import OpenAI from 'openai';

interface CodeAnalysisRequest {
  code: string;
  language: string;
  context?: string;
}

interface CodeAnalysisResult {
  vulnerabilities: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    description: string;
    recommendation: string;
    codeSnippet?: string;
  }>;
  suggestions: string[];
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

class LLMService {
  private openai: OpenAI;
  private model: string = 'gpt-4';
  
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set. LLM service will be disabled.');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyze code for vulnerabilities and security issues using LLM
   * @param request - Code analysis request with code and language
   * @returns Analysis result with vulnerabilities and suggestions
   */
  async analyzeCode(request: CodeAnalysisRequest): Promise<CodeAnalysisResult> {
    try {
      const systemPrompt = `You are an expert smart contract security auditor. Analyze the provided ${request.language} code for:
1. Security vulnerabilities (Reentrancy, Integer overflow/underflow, Unchecked calls, etc.)
2. Code quality issues
3. Gas optimization opportunities
4. Best practice violations

Respond in JSON format with the following structure:
{
  "vulnerabilities": [
    {"severity": "high"|"medium"|"low", "type": "string", "description": "string", "recommendation": "string"}
  ],
  "suggestions": ["string"],
  "overallScore": number (0-100),
  "riskLevel": "low"|"medium"|"high"|"critical"
}`;

      const userMessage = `Context: ${request.context || 'General code review'}

Analyze this ${request.language} code:

${request.code}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5,
        max_tokens: 2048
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI API');
      }

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Could not parse JSON response');
        }
        const analysis = JSON.parse(jsonMatch[0]);

        return {
          vulnerabilities: analysis.vulnerabilities || [],
          suggestions: analysis.suggestions || [],
          overallScore: analysis.overallScore || 0,
          riskLevel: analysis.riskLevel || 'medium',
          timestamp: new Date()
        };
      } catch (parseError) {
        console.error('Failed to parse LLM response:', parseError);
        return {
          vulnerabilities: [],
          suggestions: [content],
          overallScore: 0,
          riskLevel: 'medium',
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.error('LLM analysis error:', error);
      throw new Error(`Failed to analyze code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate audit report summary using LLM
   * @param auditFindings - Summary of audit findings
   * @returns Generated report summary
   */
  async generateAuditSummary(auditFindings: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert auditor. Generate a professional executive summary of the audit findings.'
          },
          {
            role: 'user',
            content: `Generate a concise executive summary of the following audit findings:\n\n${auditFindings}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1024
      });

      return response.choices[0]?.message?.content || 'No summary generated';
    } catch (error) {
      console.error('LLM summary generation error:', error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ask the Auditor - Interactive code question answering
   * @param question - User question about code
   * @param codeContext - Related code context
   * @returns Answer to the question
   */
  async askAuditor(question: string, codeContext?: string): Promise<string> {
    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        {
          role: 'system',
          content: 'You are an expert smart contract auditor called "Ask the Auditor". Provide detailed, technical answers about smart contract security and code quality.'
        }
      ];

      if (codeContext) {
        messages.push({
          role: 'user',
          content: `Code context:\n${codeContext}`
        });
      }

      messages.push({
        role: 'user',
        content: question
      });

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048
      });

      return response.choices[0]?.message?.content || 'No answer generated';
    } catch (error) {
      console.error('Ask the Auditor error:', error);
      throw new Error(`Failed to get answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if LLM service is available
   * @returns True if OpenAI API key is configured
   */
  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
}

export { LLMService, CodeAnalysisRequest, CodeAnalysisResult };
export default new LLMService();
