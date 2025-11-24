# Phase 4: AI-Powered Smart Contract Audit Platform

## Overview

Phase 4 implements the complete backend infrastructure for the Civic Digital Infrastructure Platform's AI-powered smart contract auditing system. This phase introduces repository analysis, LLM-based code review, testnet deployment, and dependency graph visualization capabilities.

## Architecture Components

### 1. Multi-File Repository Audit Service (`src/services/audit.service.ts`)

The core auditing engine that processes uploaded repositories:

**Features:**
- ZIP file extraction and management
- Repository structure scanning
- Static Application Security Testing (SAST) integration:
  - ESLint code quality checks
  - TypeScript strict mode validation
  - CodeQL security scanning
- Comprehensive vulnerability reporting
- Automatic temporary file cleanup

**Interfaces:**
```typescript
interface AuditFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
}

interface AuditReport {
  projectName: string;
  analysisDate: Date;
  totalFiles: number;
  vulnerabilities: number;
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    file: string;
    line: number;
    message: string;
  }>;
}
```

### 2. Express Server (`src/main.ts`)

Production-ready Node.js Express server with:
- CORS middleware for cross-origin requests
- Request logging and monitoring
- Health check endpoint
- Comprehensive error handling
- TypeScript strict mode compliance

**Configuration:**
- Port: 3000 (configurable via `PORT` env var)
- Max request size: 100MB
- CORS origin: Configurable via `CORS_ORIGIN` env var

### 3. RESTful API Routes (`src/routes/audit.routes.ts`)

#### Endpoint: POST /api/audit/upload
**Description:** Upload and analyze a repository ZIP file
**Request:** Multipart form data with 'repository' ZIP file
**Response:**
```json
{
  "success": true,
  "message": "Repository audit completed successfully",
  "report": { /* AuditReport */ }
}
```

#### Endpoint: GET /api/audit/health
**Description:** Check audit service health status
**Response:**
```json
{
  "status": "operational",
  "service": "Audit Service",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

#### Endpoint: POST /api/audit/analyze-code
**Description:** AI-powered code analysis using LLM (Ask the Auditor feature)
**Request:**
```json
{
  "code": "function buggyCode() { ... }",
  "language": "typescript",
  "context": "Smart contract validation"
}
```
**Response:** Code analysis with vulnerabilities and suggestions
**Status:** TODO - Requires OpenAI API integration

#### Endpoint: POST /api/audit/deploy-testnet
**Description:** One-Click Testnet Deployment
**Request:**
```json
{
  "contractCode": "// Smart contract code",
  "network": "sepolia",
  "auditId": "audit_12345"
}
```
**Response:** Deployment status and transaction details
**Status:** TODO - Requires blockchain integration

#### Endpoint: GET /api/audit/dependency-graph/:projectId
**Description:** Generate and retrieve project dependency graph
**Response:**
```json
{
  "projectId": "project_123",
  "nodes": [],
  "edges": [],
  "statistics": {
    "totalDependencies": 0,
    "criticalIssues": 0,
    "vulnerabilities": 0
  }
}
```
**Status:** TODO - Requires dependency analysis implementation

## Dependencies Added (Phase 4)

| Package | Version | Purpose |
|---------|---------|----------|
| multer | ^1.4.5-lts.1 | Multipart form data file upload handling |
| archiver | ^6.0.1 | ZIP file creation and manipulation |
| extract-zip | ^2.0.1 | ZIP file extraction functionality |
| openai | ^4.24.0 | LLM integration for code analysis |

## Environment Variables

```bash
# Server Configuration
PORT=3000                          # Server port (default: 3000)
NODE_ENV=production                # Environment mode
CORS_ORIGIN=http://localhost:3000 # CORS allowed origin

# Optional: LLM Integration
OPENAI_API_KEY=sk-...             # OpenAI API key for Ask the Auditor

# Optional: Blockchain Deployment
SEPOLIA_RPC_URL=...               # Sepolia testnet RPC endpoint
PRIVATE_KEY=...                   # Deployment account private key
```

## Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Build TypeScript:**
   ```bash
   npm run build
   ```

3. **Start Server:**
   ```bash
   npm start
   ```

4. **Development Mode:**
   ```bash
   npm run dev
   ```

## Usage Examples

### Upload Repository for Audit
```bash
curl -X POST http://localhost:3000/api/audit/upload \
  -F "repository=@myrepo.zip"
```

### Check Service Health
```bash
curl http://localhost:3000/api/audit/health
```

### Analyze Code with AI
```bash
curl -X POST http://localhost:3000/api/audit/analyze-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function checkBalance(address) { ... }",
    "language": "solidity",
    "context": "Token contract balance check"
  }'
```

## File Structure

```
src/
├── main.ts                 # Express server entry point
├── services/
│   └── audit.service.ts    # Core audit service
├── routes/
│   ├── audit.routes.ts     # API endpoints
│   └── index.ts            # Route aggregation
├── models/                 # Data models & interfaces
└── utils/                  # Utility functions
```

## Remaining Phase 4 Tasks

- [ ] LLM Integration with OpenAI API for "Ask the Auditor" feature
- [ ] Blockchain deployment logic for testnet deployment
- [ ] Dependency graph visualization and analysis
- [ ] Enhanced error handling and logging
- [ ] API documentation with Swagger/OpenAPI
- [ ] Unit tests for all services
- [ ] Integration tests for API endpoints

## Production Considerations

1. **Security:**
   - Implement rate limiting
   - Add API key authentication
   - Validate all file uploads
   - Sanitize user inputs

2. **Performance:**
   - Implement caching for audit reports
   - Use async workers for large file processing
   - Add database for audit history

3. **Monitoring:**
   - Add structured logging
   - Implement health checks
   - Monitor resource usage
   - Set up alerting

## References

- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [OpenAI API](https://platform.openai.com/)
- [Web3.js Documentation](https://docs.web3js.org/)

## Version

**Phase 4 - v1.0.0**

Released: 2024
Last Updated: 2024

---

*Civic Digital Infrastructure Platform - Building secure smart contract ecosystems through AI-powered auditing*
