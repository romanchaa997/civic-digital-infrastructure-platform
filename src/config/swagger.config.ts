/**
 * Swagger/OpenAPI Configuration
 * Defines API documentation for all 8 endpoints
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Civic Digital Infrastructure Platform API',
      version: '1.0.0',
      description: 'Comprehensive API for security auditing, LLM integration, blockchain deployment, and dependency analysis',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.audityzer.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ['./src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Endpoint Schemas and Responses
 */
export const apiEndpoints = {
  'POST /upload': {
    description: 'Upload code repository for auditing',
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } },
        },
      },
    },
    responses: {
      '200': { description: 'Upload successful' },
      '400': { description: 'Invalid files' },
    },
  },
  'GET /health': {
    description: 'Health check endpoint',
    responses: {
      '200': { description: 'Service is healthy' },
    },
  },
  'POST /analyze-code': {
    description: 'Analyze code for security issues and best practices',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              language: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Analysis completed' },
    },
  },
  'POST /ask-auditor': {
    description: 'Ask AI auditor questions about code',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              context: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'AI response provided' },
    },
  },
  'POST /deploy-testnet': {
    description: 'Deploy smart contract to testnet',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              contractCode: { type: 'string' },
              network: { type: 'string', enum: ['sepolia', 'mumbai', 'arbitrum-goerli'] },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Deployment successful' },
    },
  },
  'GET /supported-networks': {
    description: 'Get list of supported blockchain networks',
    responses: {
      '200': { description: 'List of supported networks' },
    },
  },
  'POST /dependency-graph': {
    description: 'Generate dependency graph for project',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Dependency graph generated' },
    },
  },
  'POST /analyze-dependencies': {
    description: 'Analyze dependencies for vulnerabilities and circular dependencies',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              dependencies: { type: 'object' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Analysis completed' },
    },
  },
};

export default swaggerSpec;
