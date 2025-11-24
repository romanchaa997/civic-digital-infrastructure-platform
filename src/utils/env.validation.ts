/**
 * Environment Variable Validation Module
 * Validates required environment variables at application startup
 */

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Required environment variables with default values
 */
interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  CORS_ORIGIN: string;
  OPENAI_API_KEY: string;
  SEPOLIA_RPC_URL: string;
  MUMBAI_RPC_URL: string;
  ARBITRUM_GOERLI_RPC_URL: string;
  DEPLOYMENT_PRIVATE_KEY: string;
  API_KEY_SECRET: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  AUDIT_CACHE_TTL: number;
  AUDIT_MAX_FILE_SIZE: number;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FORMAT: 'json' | 'text';
}

/**
 * Validate required environment variables
 * @throws Error if any required variable is missing
 * @returns Validated environment configuration
 */
export function validateEnv(): EnvConfig {
  const requiredVars = [
    'PORT',
    'NODE_ENV',
    'CORS_ORIGIN',
    'OPENAI_API_KEY',
    'SEPOLIA_RPC_URL',
    'MUMBAI_RPC_URL',
    'ARBITRUM_GOERLI_RPC_URL',
    'DEPLOYMENT_PRIVATE_KEY',
    'API_KEY_SECRET',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
        `Please check your .env file and ensure all required variables are set.`
    );
  }

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: (process.env.NODE_ENV as any) || 'production',
    CORS_ORIGIN: process.env.CORS_ORIGIN!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL!,
    MUMBAI_RPC_URL: process.env.MUMBAI_RPC_URL!,
    ARBITRUM_GOERLI_RPC_URL: process.env.ARBITRUM_GOERLI_RPC_URL!,
    DEPLOYMENT_PRIVATE_KEY: process.env.DEPLOYMENT_PRIVATE_KEY!,
    API_KEY_SECRET: process.env.API_KEY_SECRET!,
    RATE_LIMIT_WINDOW_MS: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || '3600000',
      10
    ),
    RATE_LIMIT_MAX_REQUESTS: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      10
    ),
    AUDIT_CACHE_TTL: parseInt(process.env.AUDIT_CACHE_TTL || '300000', 10),
    AUDIT_MAX_FILE_SIZE: parseInt(
      process.env.AUDIT_MAX_FILE_SIZE || '5242880',
      10
    ),
    LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
    LOG_FORMAT: (process.env.LOG_FORMAT as any) || 'json',
  };
}

// Export validated configuration
export const envConfig = validateEnv();

export default envConfig;
