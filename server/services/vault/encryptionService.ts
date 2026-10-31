/**
 * Encryption Service for Vault
 * Handles AES-256-GCM encryption/decryption of secrets
 */

import crypto from "crypto";

export interface EncryptedData {
  encryptedValue: string;
  iv: string;
  authTag: string;
  algorithm: string;
}

export interface DecryptedData {
  value: string;
  algorithm: string;
}

export class EncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private masterKey: Buffer;

  constructor(masterKey?: string) {
    if (!masterKey) {
      const envKey = process.env.VAULT_MASTER_KEY;
      if (!envKey) {
        throw new Error("VAULT_MASTER_KEY environment variable is required");
      }
      masterKey = envKey;
    }

    // Derive a 256-bit key from the master key using PBKDF2
    this.masterKey = crypto.pbkdf2Sync(masterKey, "centinela-vault", 100000, this.keyLength, "sha256");
  }

  /**
   * Encrypt a secret value
   */
  encrypt(plaintext: string): EncryptedData {
    // Generate random IV
    const iv = crypto.randomBytes(this.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encryptedValue: encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      algorithm: this.algorithm,
    };
  }

  /**
   * Decrypt a secret value
   */
  decrypt(encryptedData: EncryptedData): DecryptedData {
    try {
      const iv = Buffer.from(encryptedData.iv, "hex");
      const authTag = Buffer.from(encryptedData.authTag, "hex");
      const encryptedValue = encryptedData.encryptedValue;

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encryptedValue, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return {
        value: decrypted,
        algorithm: this.algorithm,
      };
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate a hash of a secret for comparison (without storing the secret)
   */
  hash(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  /**
   * Verify if a plaintext matches a hash
   */
  verifyHash(plaintext: string, hash: string): boolean {
    return this.hash(plaintext) === hash;
  }

  /**
   * Generate a random secret (for auto-rotation)
   */
  generateRandomSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Rotate master key (for emergency scenarios)
   * Returns new encrypted data with new master key
   */
  rotateMasterKey(encryptedData: EncryptedData, newMasterKey: string): EncryptedData {
    // Decrypt with old key
    const decrypted = this.decrypt(encryptedData);

    // Create new instance with new key
    const newService = new EncryptionService(newMasterKey);

    // Encrypt with new key
    return newService.encrypt(decrypted.value);
  }

  /**
   * Validate encryption parameters
   */
  validateEncryptionData(data: EncryptedData): boolean {
    try {
      if (!data.encryptedValue || !data.iv || !data.authTag) {
        return false;
      }

      // Validate hex format
      if (!/^[0-9a-f]*$/.test(data.iv) || !/^[0-9a-f]*$/.test(data.authTag) || !/^[0-9a-f]*$/.test(data.encryptedValue)) {
        return false;
      }

      // Validate lengths
      if (data.iv.length !== this.ivLength * 2) return false; // hex string is 2x length
      if (data.authTag.length !== 32) return false; // 16 bytes = 32 hex chars

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance for vault encryption
 */
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

/**
 * Initialize encryption service with custom master key
 */
export function initializeEncryptionService(masterKey: string): EncryptionService {
  encryptionServiceInstance = new EncryptionService(masterKey);
  return encryptionServiceInstance;
}
