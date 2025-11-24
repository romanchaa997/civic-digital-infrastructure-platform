/**
 * Phase 4: Main Application Entry Point
 * Express server setup with audit routes and middleware configuration
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Import route modules
import auditRoutes from './routes/audit.routes';

// Load environment variables
dotenv.config();

// Create Express application instance
const app: Express = express();

// Environment variables with defaults
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV: string = process.env.NODE_ENV || 'development';
const CORS_ORIGIN: string = process.env.CORS_ORIGIN || 'http://localhost:3000';

/**
 * Middleware Configuration
 */

// CORS middleware - enable cross-origin requests
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health Check Endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0'
  });
});

/**
 * API Routes
 */

// Mount audit routes at /api/audit
app.use('/api/audit', auditRoutes);

/**
 * API Documentation
 */
app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'Civic Digital Infrastructure Platform - Phase 4',
    version: '1.0.0',
    description: 'AI-powered smart contract audit platform',
    endpoints: {
      health: 'GET /health',
      audit: {
        upload: 'POST /api/audit/upload',
        health: 'GET /api/audit/health',
        analyze: 'POST /api/audit/analyze-code',
        deployTestnet: 'POST /api/audit/deploy-testnet',
        dependencyGraph: 'GET /api/audit/dependency-graph/:projectId'
      }
    }
  });
});

/**
 * Error Handling Middleware
 */

// 404 Not Found handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode: number = err.statusCode || 500;
  const message: string = err.message || 'Internal Server Error';
  
  console.error(`[Error] ${statusCode}: ${message}`);
  console.error(err.stack);
  
  res.status(statusCode).json({
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

/**
 * Server Startup
 */

const startServer = async (): Promise<void> => {
  try {
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`Civic Digital Infrastructure Platform`);
      console.log(`Server started on port ${PORT}`);
      console.log(`Environment: ${NODE_ENV}`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
