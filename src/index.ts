import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API v1 status endpoint
app.get('/api/v1/status', (req: Request, res: Response) => {
  res.json({
    service: 'Civic Digital Infrastructure Platform',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Civic Digital Infrastructure Platform API',
    docs: '/api/docs',
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
