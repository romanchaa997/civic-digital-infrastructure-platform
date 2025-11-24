import axios, { AxiosInstance } from 'axios';
import { logger } from '../monitoring/logger';

export interface SecretData {
  [key: string]: string;
}

export interface VaultResponse {
  auth?: { client_token: string };
  data?: { data: SecretData };
}

export class VaultConfig {
  private client: AxiosInstance;
  private token: string | null = null;
  private vaultAddr: string;
  private roleId: string;
  private secretId: string;
  private secretCache: Map<string, { value: SecretData; expiresAt: number }> = new Map();
  private cacheTTL: number = 3600000; // 1 hour

  constructor(
    vaultAddr = process.env.VAULT_ADDR || 'http://vault:8200',
    roleId = process.env.VAULT_ROLE_ID || '',
    secretId = process.env.VAULT_SECRET_ID || ''
  ) {
    this.vaultAddr = vaultAddr;
    this.roleId = roleId;
    this.secretId = secretId;
    this.client = axios.create({
      baseURL: vaultAddr,
      timeout: 5000,
      validateStatus: () => true // Don't throw on any status
    });
  }

  /**
   * Authenticate with Vault using AppRole
   */
  async authenticate(): Promise<boolean> {
    try {
      const response = await this.client.post<VaultResponse>('/v1/auth/approle/login', {
        role_id: this.roleId,
        secret_id: this.secretId
      });

      if (response.data?.auth?.client_token) {
        this.token = response.data.auth.client_token;
        this.client.defaults.headers.common['X-Vault-Token'] = this.token;
        logger.info('Vault authentication successful');
        return true;
      }
      logger.error('Vault authentication failed: no token received');
      return false;
    } catch (error) {
      logger.error(`Vault authentication error: ${error}`);
      return false;
    }
  }

  /**
   * Read secret from Vault
   */
  async readSecret(path: string): Promise<SecretData | null> {
    try {
      // Check cache first
      const cached = this.secretCache.get(path);
      if (cached && cached.expiresAt > Date.now()) {
        logger.debug(`Retrieved secret from cache: ${path}`);
        return cached.value;
      }

      // Ensure authenticated
      if (!this.token) {
        const authenticated = await this.authenticate();
        if (!authenticated) return null;
      }

      const response = await this.client.get<VaultResponse>(`/v1/${path}`);
      
      if (response.data?.data?.data) {
        const secretData = response.data.data.data;
        // Cache the secret
        this.secretCache.set(path, {
          value: secretData,
          expiresAt: Date.now() + this.cacheTTL
        });
        logger.info(`Retrieved secret: ${path}`);
        return secretData;
      }
      
      logger.warn(`Secret not found: ${path}`);
      return null;
    } catch (error) {
      logger.error(`Error reading secret ${path}: ${error}`);
      return null;
    }
  }

  /**
   * Write secret to Vault
   */
  async writeSecret(path: string, data: SecretData): Promise<boolean> {
    try {
      if (!this.token) {
        const authenticated = await this.authenticate();
        if (!authenticated) return false;
      }

      const response = await this.client.post(`/v1/${path}`, { data });
      
      if (response.status === 200 || response.status === 204) {
        this.secretCache.delete(path); // Invalidate cache
        logger.info(`Secret written: ${path}`);
        return true;
      }
      
      logger.error(`Failed to write secret ${path}: ${response.status}`);
      return false;
    } catch (error) {
      logger.error(`Error writing secret ${path}: ${error}`);
      return false;
    }
  }

  /**
   * Delete secret from Vault
   */
  async deleteSecret(path: string): Promise<boolean> {
    try {
      if (!this.token) {
        const authenticated = await this.authenticate();
        if (!authenticated) return false;
      }

      const response = await this.client.delete(`/v1/${path}`);
      
      if (response.status === 204) {
        this.secretCache.delete(path);
        logger.info(`Secret deleted: ${path}`);
        return true;
      }
      
      logger.error(`Failed to delete secret ${path}: ${response.status}`);
      return false;
    } catch (error) {
      logger.error(`Error deleting secret ${path}: ${error}`);
      return false;
    }
  }

  /**
   * Generate dynamic credentials (database)
   */
  async generateDynamicCredentials(roleName: string): Promise<{ username: string; password: string } | null> {
    try {
      if (!this.token) {
        const authenticated = await this.authenticate();
        if (!authenticated) return null;
      }

      const response = await this.client.get<VaultResponse>(`/v1/database/creds/${roleName}`);
      
      if (response.data?.data?.data) {
        const { username, password } = response.data.data.data;
        logger.info(`Generated dynamic credentials for role: ${roleName}`);
        return { username, password };
      }
      
      return null;
    } catch (error) {
      logger.error(`Error generating credentials for ${roleName}: ${error}`);
      return null;
    }
  }

  /**
   * Clear secret cache
   */
  clearCache(path?: string): void {
    if (path) {
      this.secretCache.delete(path);
    } else {
      this.secretCache.clear();
    }
    logger.debug('Secret cache cleared');
  }

  /**
   * Get Vault health status
   */
  async getHealthStatus(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/sys/health');
      return response.status === 200 || response.status === 473; // 473 = Vault sealed but usable
    } catch (error) {
      logger.error(`Vault health check failed: ${error}`);
      return false;
    }
  }
}

export default VaultConfig;
