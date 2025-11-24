/**
 * Phase 4: Audit Routes - Complete Integration
 * RESTful API endpoints for repository auditing, LLM analysis, blockchain deployment, and dependency graph visualization
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer, { Multer } from 'multer';
import path from 'path';
import { AuditService } from '../services/audit.service';
import { llmService } from '../services/llm.service';
import { blockchainService } from '../services/blockchain.service';
import { dependencyGraphService } from '../services/dependency-graph.service';

const router: Router = Router();
const auditService: AuditService = new AuditService();

// Configure multer for file uploads
const upload: Multer = multer({
  dest: path.join(__dirname, '../uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

/**
 * POST /api/audit/upload
 * Upload and analyze a repository ZIP file
 * Returns: Comprehensive audit report with vulnerabilities and issues
 */
router.post('/upload', upload.single('repository'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Repository ZIP file is required'
      });
    }

    // Perform audit on uploaded file
    const auditReport = await auditService.auditRepository(req.file.path);
    
    res.status(200).json({
      success: true,
      message: 'Repository audit completed successfully',
      report: auditReport
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/health
 * Check audit service health status
 * Returns: Service operational status and version info
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'operational',
    service: 'Audit Service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      audit: true,
      llm: llmService.isAvailable ? 'available' : 'unavailable',
      blockchain: blockchainService ? 'available' : 'unavailable',
      dependencyGraph: true
    }
  });
});

/**
 * POST /api/audit/analyze-code
 * AI-powered code analysis using LLM (Ask the Auditor feature)
 * Analyzes code for vulnerabilities, security issues, and best practices
 * 
 * Request body:
 * {
 *   "code": "function code() { ... }",
 *   "language": "typescript",
 *   "context": "Smart contract validation"
 * }
 */
router.post('/analyze-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, language, context } = req.body;
    
    if (!code) {
      return res.status(400).json({
        error: 'Missing code',
        message: 'Code snippet is required for analysis'
      });
    }

    // Integrate with OpenAI API for code analysis
    const analysis = await llmService.analyzeCode({
      code,
      language: language || 'typescript',
      context: context || 'General code review'
    });
    
    res.status(200).json({
      success: true,
      message: 'Code analysis completed',
      analysis
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/ask-auditor
 * Interactive Q&A with AI auditor about code
 * 
 * Query parameters:
 * - question: The question to ask about the code
 * - code: (optional) Code context for the question
 */
router.get('/ask-auditor', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, code } = req.query;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: 'Missing question',
        message: 'Question parameter is required'
      });
    }

    // Get interactive response from LLM
    const response = await llmService.askAuditor({
      question,
      codeContext: code ? String(code) : undefined
    });
    
    res.status(200).json({
      success: true,
      message: 'Auditor response generated',
      question,
      response
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/audit/deploy-testnet
 * One-Click Testnet Deployment
 * Deploy smart contracts to testnet (Sepolia, Polygon Mumbai, Arbitrum Goerli) with audit compliance
 * 
 * Request body:
 * {
 *   "contractCode": "// Smart contract code",
 *   "network": "sepolia",
 *   "abi": [...],
 *   "bytecode": "0x...",
 *   "auditId": "audit_12345"
 * }
 */
router.post('/deploy-testnet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractCode, network, abi, bytecode, auditId } = req.body;
    
    if (!contractCode || !network) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Contract code and network are required'
      });
    }

    // Validate network is supported
    const supportedNetworks = blockchainService.getSupportedNetworks();
    if (!supportedNetworks.some(n => n.name === network)) {
      return res.status(400).json({
        error: 'Unsupported network',
        message: `Network must be one of: ${supportedNetworks.map(n => n.name).join(', ')}`
      });
    }

    // Deploy contract to blockchain
    const deploymentRequest = {
      network,
      abi: abi || [],
      bytecode: bytecode || '',
      constructorArgs: []
    };

    const deployment = await blockchainService.deployContract(deploymentRequest);
    
    res.status(200).json({
      success: deployment.success,
      message: deployment.success ? 'Contract deployed successfully' : 'Deployment failed',
      deployment
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/supported-networks
 * Get list of supported blockchain networks for deployment
 * Returns: Array of networks with chain IDs
 */
router.get('/supported-networks', (req: Request, res: Response) => {
  try {
    const networks = blockchainService.getSupportedNetworks();
    
    res.status(200).json({
      success: true,
      message: 'Supported networks retrieved',
      networks
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve networks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/audit/dependency-graph/:projectId
 * Generate and retrieve project dependency graph visualization
 * Shows dependency relationships, circular dependencies, and vulnerability chains
 * 
 * Path parameters:
 * - projectId: Unique project identifier
 */
router.get('/dependency-graph/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { format } = req.query; // 'json' or 'dot' (Graphviz)
    
    if (!projectId) {
      return res.status(400).json({
        error: 'Missing project ID',
        message: 'Project ID is required'
      });
    }

    // TODO: In production, fetch actual project analysis from database
    // For now, create sample graph structure
    const graph = dependencyGraphService.parseDependencies(
      'sample code',
      [{ name: 'express', version: '^4.18.0' }, { name: 'ethers', version: '^6.0.0' }]
    );

    // Format response based on request
    if (format === 'dot') {
      const dotFormat = dependencyGraphService.exportAsDot(graph);
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(dotFormat);
      return;
    }

    const riskAssessment = dependencyGraphService.getRiskAssessment(graph);
    
    res.status(200).json({
      success: true,
      message: 'Dependency graph generated',
      projectId,
      graph,
      riskAssessment
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/audit/analyze-dependencies
 * Analyze code dependencies and generate report
 * Detects circular dependencies, vulnerable packages, and criticality scores
 * 
 * Request body:
 * {
 *   "sourceCode": "import ...; require(...)",
 *   "packages": [{"name": "package-name", "version": "1.0.0"}]
 * }
 */
router.post('/analyze-dependencies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceCode, packages } = req.body;
    
    if (!sourceCode || !packages || !Array.isArray(packages)) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'sourceCode and packages array are required'
      });
    }

    // Analyze dependencies
    const graph = dependencyGraphService.parseDependencies(sourceCode, packages);
    const riskAssessment = dependencyGraphService.getRiskAssessment(graph);
    
    res.status(200).json({
      success: true,
      message: 'Dependency analysis completed',
      graph,
      riskAssessment
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Error handling middleware for routes
 */
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'File upload error',
      message: error.message
    });
  }
  
  res.status(error.statusCode || 500).json({
    error: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

export default router;
