import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

/**
 * PHASE 2: Post-Quantum Cryptography Utilities
 * ML-KEM-1024 (Kyber) & ML-DSA (Dilithium) wrappers
 * Integration with liboqs-nodejs for production use
 */

export interface PQCKeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
  algorithm: 'ML-KEM-1024' | 'ML-DSA';
  createdAt: Date;
}

export interface EncryptedData {
  ciphertext: Buffer;
  sharedSecret?: Buffer;
  timestamp: Date;
  algorithm: string;
}

export class PQCUtilities {
  private logger: Logger;
  private keyCache: Map<string, PQCKeyPair> = new Map();
  private rotationInterval: number = 90 * 24 * 60 * 60 * 1000; // 90 days

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Generate ML-KEM-1024 (Kyber) key pair
   * For audit log encryption (confidentiality)
   */
  public generateMLKEMKeyPair(keyId: string): PQCKeyPair {
    try {
      // Placeholder: In production, use liboqs-nodejs
      // npm install liboqs-nodejs
      // const oqs = require('liboqs');
      // const kem = new oqs.KeyEncapsulation('ML-KEM-1024');
      // const { public_key } = kem.generate_keys();
      
      const publicKey = crypto.randomBytes(1568); // ML-KEM-1024 public key size
      const privateKey = crypto.randomBytes(3168); // ML-KEM-1024 private key size

      const keyPair: PQCKeyPair = {
        publicKey,
        privateKey,
        algorithm: 'ML-KEM-1024',
        createdAt: new Date()
      };

      this.keyCache.set(keyId, keyPair);
      this.logger.info(`Generated ML-KEM-1024 key pair: ${keyId}`);
      
      return keyPair;
    } catch (error) {
      this.logger.error('Failed to generate ML-KEM key pair', error);
      throw error;
    }
  }

  /**
   * Generate ML-DSA (Dilithium) key pair
   * For audit log signatures (authenticity)
   */
  public generateMLDSAKeyPair(keyId: string): PQCKeyPair {
    try {
      // Placeholder: In production, use liboqs-nodejs
      // const sig = new oqs.Signature('ML-DSA');
      // const { public_key } = sig.generate_keys();
      
      const publicKey = crypto.randomBytes(1312); // ML-DSA public key size
      const privateKey = crypto.randomBytes(2560); // ML-DSA private key size

      const keyPair: PQCKeyPair = {
        publicKey,
        privateKey,
        algorithm: 'ML-DSA',
        createdAt: new Date()
      };

      this.keyCache.set(keyId, keyPair);
      this.logger.info(`Generated ML-DSA key pair: ${keyId}`);
      
      return keyPair;
    } catch (error) {
      this.logger.error('Failed to generate ML-DSA key pair', error);
      throw error;
    }
  }

  /**
   * Encapsulate shared secret using ML-KEM-1024
   */
  public encapsulate(publicKeyId: string): EncryptedData {
    try {
      const keyPair = this.keyCache.get(publicKeyId);
      if (!keyPair || keyPair.algorithm !== 'ML-KEM-1024') {
        throw new Error(`Invalid or missing key: ${publicKeyId}`);
      }

      // Placeholder: Use liboqs-nodejs for real encapsulation
      const ciphertext = crypto.randomBytes(1088); // ML-KEM-1024 ciphertext size
      const sharedSecret = crypto.randomBytes(32); // 256-bit shared secret

      return {
        ciphertext,
        sharedSecret,
        timestamp: new Date(),
        algorithm: 'ML-KEM-1024'
      };
    } catch (error) {
      this.logger.error('Encapsulation failed', error);
      throw error;
    }
  }

  /**
   * Decapsulate shared secret using private key
   */
  public decapsulate(keyId: string, ciphertext: Buffer): Buffer {
    try {
      const keyPair = this.keyCache.get(keyId);
      if (!keyPair || keyPair.algorithm !== 'ML-KEM-1024') {
        throw new Error(`Invalid key: ${keyId}`);
      }

      // Placeholder: Use liboqs-nodejs for real decapsulation
      const sharedSecret = crypto.createHash('sha256')
        .update(Buffer.concat([keyPair.privateKey, ciphertext]))
        .digest();

      return sharedSecret;
    } catch (error) {
      this.logger.error('Decapsulation failed', error);
      throw error;
    }
  }

  /**
   * Sign data with ML-DSA
   */
  public sign(keyId: string, data: Buffer): Buffer {
    try {
      const keyPair = this.keyCache.get(keyId);
      if (!keyPair || keyPair.algorithm !== 'ML-DSA') {
        throw new Error(`Invalid key: ${keyId}`);
      }

      // Placeholder: Use liboqs-nodejs for real signing
      const signature = crypto.createHmac('sha256', keyPair.privateKey)
        .update(data)
        .digest();

      return signature;
    } catch (error) {
      this.logger.error('Signing failed', error);
      throw error;
    }
  }

  /**
   * Verify ML-DSA signature
   */
  public verify(keyId: string, data: Buffer, signature: Buffer): boolean {
    try {
      const keyPair = this.keyCache.get(keyId);
      if (!keyPair || keyPair.algorithm !== 'ML-DSA') {
        throw new Error(`Invalid key: ${keyId}`);
      }

      // Placeholder: Use liboqs-nodejs for real verification
      const expectedSignature = crypto.createHmac('sha256', keyPair.privateKey)
        .update(data)
        .digest();

      return Buffer.compare(signature, expectedSignature) === 0;
    } catch (error) {
      this.logger.error('Verification failed', error);
      return false;
    }
  }

  /**
   * Key rotation check (90-day policy)
   */
  public shouldRotateKey(keyId: string): boolean {
    const keyPair = this.keyCache.get(keyId);
    if (!keyPair) return false;

    const age = Date.now() - keyPair.createdAt.getTime();
    return age > this.rotationInterval;
  }

  /**
   * Rotate key material
   */
  public rotateKey(oldKeyId: string, newKeyId: string): PQCKeyPair {
    try {
      const oldKeyPair = this.keyCache.get(oldKeyId);
      if (!oldKeyPair) {
        throw new Error(`Key not found: ${oldKeyId}`);
      }

      let newKeyPair: PQCKeyPair;
      if (oldKeyPair.algorithm === 'ML-KEM-1024') {
        newKeyPair = this.generateMLKEMKeyPair(newKeyId);
      } else {
        newKeyPair = this.generateMLDSAKeyPair(newKeyId);
      }

      // Log key rotation event
      this.logger.info(`Key rotated: ${oldKeyId} -> ${newKeyId}`);
      this.keyCache.delete(oldKeyId);

      return newKeyPair;
    } catch (error) {
      this.logger.error('Key rotation failed', error);
      throw error;
    }
  }

  /**
   * Get key metadata for auditing
   */
  public getKeyMetadata(keyId: string): any {
    const keyPair = this.keyCache.get(keyId);
    if (!keyPair) return null;

    return {
      keyId,
      algorithm: keyPair.algorithm,
      createdAt: keyPair.createdAt,
      age: Date.now() - keyPair.createdAt.getTime(),
      needsRotation: this.shouldRotateKey(keyId),
      publicKeyHash: crypto.createHash('sha256').update(keyPair.publicKey).digest('hex')
    };
  }
}

// Export singleton instance
export const pqcUtils = new PQCUtilities();
