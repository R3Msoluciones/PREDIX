/**
 * Vault Manager
 * Manages secret storage, retrieval, and lifecycle — persistido en MySQL
 * (secret_vault / secret_audit_log / secret_rotation_history, ver
 * drizzle/schema.ts). Antes vivía en un Map/Array en memoria del proceso
 * ("in-memory storage for demo") — se perdía todo al reiniciar el servidor.
 */

import { and, desc, eq, lte } from "drizzle-orm";
import { getDb } from "../../config/db";
import { secretVault, secretAuditLog, secretRotationHistory } from "../../../drizzle/schema";
import { EncryptionService, getEncryptionService } from "./encryptionService";
import { logger } from "../../_core/logger";

export interface SecretConfig {
  integrationId: string;
  secretName: string;
  secretType: "API_KEY" | "OAUTH_TOKEN" | "BASIC_AUTH" | "CERTIFICATE" | "CUSTOM";
  secretValue: string;
  expiresAt?: Date;
  rotationInterval?: number;
}

export interface SecretInfo {
  id: number;
  integrationId: string;
  secretName: string;
  secretType: string;
  expiresAt?: Date;
  rotationInterval?: number;
  lastRotatedAt?: Date;
  nextRotationAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: number;
  secretId: number;
  integrationId: string;
  userId: number;
  action: string;
  status: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

function toSecretInfo(row: typeof secretVault.$inferSelect): SecretInfo {
  return {
    id: row.id,
    integrationId: row.integrationId,
    secretName: row.secretName,
    secretType: row.secretType,
    expiresAt: row.expiresAt ?? undefined,
    rotationInterval: row.rotationInterval ?? undefined,
    lastRotatedAt: row.lastRotatedAt ?? undefined,
    nextRotationAt: row.nextRotationAt ?? undefined,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAuditEntry(row: typeof secretAuditLog.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    secretId: row.secretId,
    integrationId: row.integrationId,
    userId: row.userId,
    action: row.action,
    status: row.status,
    reason: row.reason ?? undefined,
    ipAddress: row.ipAddress ?? undefined,
    userAgent: row.userAgent ?? undefined,
    timestamp: row.timestamp,
  };
}

export class VaultManager {
  private encryptionService: EncryptionService;

  constructor(encryptionService?: EncryptionService) {
    this.encryptionService = encryptionService || getEncryptionService();
  }

  /**
   * Store a secret in the vault
   */
  async storeSecret(config: SecretConfig, userId: number, ipAddress?: string): Promise<SecretInfo> {
    const db = await getDb();
    if (!db) throw new Error("Vault no disponible (sin conexión a BD)");

    const encrypted = this.encryptionService.encrypt(config.secretValue);
    const nextRotationAt = config.rotationInterval ? new Date(Date.now() + config.rotationInterval * 24 * 60 * 60 * 1000) : null;
    const now = new Date();

    const result = await db.insert(secretVault).values({
      integrationId: config.integrationId,
      secretName: config.secretName,
      secretType: config.secretType,
      encryptedValue: encrypted.encryptedValue,
      encryptionAlgorithm: encrypted.algorithm,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag,
      expiresAt: config.expiresAt,
      rotationInterval: config.rotationInterval,
      lastRotatedAt: now,
      nextRotationAt,
      isActive: 1,
      createdBy: userId,
    });
    const secretId = result[0].insertId;

    await this.logAuditEvent({ secretId, integrationId: config.integrationId, userId, action: "CREATE", status: "SUCCESS", ipAddress });

    return this.getSecretInfo(secretId);
  }

  /**
   * Retrieve a secret from the vault
   */
  async retrieveSecret(secretId: number, userId: number, ipAddress?: string): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Vault no disponible (sin conexión a BD)");

    const [secret] = await db.select().from(secretVault).where(eq(secretVault.id, secretId));

    if (!secret) {
      await this.logAuditEvent({ secretId, integrationId: "unknown", userId, action: "READ", status: "FAILED", reason: "Secret not found", ipAddress });
      throw new Error("Secret not found");
    }

    if (secret.isActive !== 1) {
      await this.logAuditEvent({ secretId, integrationId: secret.integrationId, userId, action: "READ", status: "DENIED", reason: "Secret is inactive", ipAddress });
      throw new Error("Secret is inactive");
    }

    if (secret.expiresAt && new Date() > secret.expiresAt) {
      await this.logAuditEvent({ secretId, integrationId: secret.integrationId, userId, action: "READ", status: "DENIED", reason: "Secret has expired", ipAddress });
      throw new Error("Secret has expired");
    }

    const decrypted = this.encryptionService.decrypt({
      encryptedValue: secret.encryptedValue,
      iv: secret.encryptionIv,
      authTag: secret.encryptionAuthTag,
      algorithm: secret.encryptionAlgorithm,
    });

    await this.logAuditEvent({ secretId, integrationId: secret.integrationId, userId, action: "READ", status: "SUCCESS", ipAddress });

    return decrypted.value;
  }

  /**
   * Update a secret's value (edición directa, sin registrar historial de rotación)
   */
  async updateSecret(secretId: number, newValue: string, userId: number, ipAddress?: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Vault no disponible (sin conexión a BD)");

    const [secret] = await db.select().from(secretVault).where(eq(secretVault.id, secretId));
    if (!secret) throw new Error("Secret not found");

    const encrypted = this.encryptionService.encrypt(newValue);
    await db.update(secretVault).set({
      encryptedValue: encrypted.encryptedValue,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag,
    }).where(eq(secretVault.id, secretId));

    await this.logAuditEvent({ secretId, integrationId: secret.integrationId, userId, action: "UPDATE", status: "SUCCESS", ipAddress });
  }

  /**
   * Rota un secreto: genera nuevo valor cifrado, actualiza lastRotatedAt/
   * nextRotationAt y deja registro forense en secret_rotation_history
   * (hashes del valor viejo/nuevo, nunca el valor en claro).
   */
  async rotateSecret(secretId: number, newValue: string, userId: number, ipAddress?: string): Promise<SecretInfo> {
    const db = await getDb();
    if (!db) throw new Error("Vault no disponible (sin conexión a BD)");

    const [secret] = await db.select().from(secretVault).where(eq(secretVault.id, secretId));
    if (!secret) throw new Error("Secret not found");

    const oldValue = this.encryptionService.decrypt({
      encryptedValue: secret.encryptedValue,
      iv: secret.encryptionIv,
      authTag: secret.encryptionAuthTag,
      algorithm: secret.encryptionAlgorithm,
    });
    const encrypted = this.encryptionService.encrypt(newValue);
    const now = new Date();
    const nextRotationAt = secret.rotationInterval ? new Date(now.getTime() + secret.rotationInterval * 24 * 60 * 60 * 1000) : null;

    await db.update(secretVault).set({
      encryptedValue: encrypted.encryptedValue,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag,
      lastRotatedAt: now,
      nextRotationAt,
    }).where(eq(secretVault.id, secretId));

    await db.insert(secretRotationHistory).values({
      secretId,
      integrationId: secret.integrationId,
      rotationType: "MANUAL",
      oldValueHash: this.encryptionService.hash(oldValue.value),
      newValueHash: this.encryptionService.hash(newValue),
      rotatedBy: userId,
      status: "COMPLETED",
      completedAt: now,
    });

    await this.logAuditEvent({ secretId, integrationId: secret.integrationId, userId, action: "ROTATE", status: "SUCCESS", ipAddress });

    return this.getSecretInfo(secretId);
  }

  /**
   * Delete a secret (soft delete — isActive=false, se conserva para auditoría)
   */
  async deleteSecret(secretId: number, userId: number, ipAddress?: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Vault no disponible (sin conexión a BD)");

    const [secret] = await db.select().from(secretVault).where(eq(secretVault.id, secretId));
    if (!secret) throw new Error("Secret not found");

    await db.update(secretVault).set({ isActive: 0 }).where(eq(secretVault.id, secretId));

    await this.logAuditEvent({ secretId, integrationId: secret.integrationId, userId, action: "DELETE", status: "SUCCESS", ipAddress });
  }

  /**
   * Get secret metadata
   */
  async getSecretInfo(secretId: number): Promise<SecretInfo> {
    const db = await getDb();
    if (!db) throw new Error("Vault no disponible (sin conexión a BD)");

    const [secret] = await db.select().from(secretVault).where(eq(secretVault.id, secretId));
    if (!secret) throw new Error("Secret not found");
    return toSecretInfo(secret);
  }

  /**
   * List all secrets for an integration
   */
  async listSecrets(integrationId: string): Promise<SecretInfo[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select().from(secretVault).where(eq(secretVault.integrationId, integrationId));
    return rows.map(toSecretInfo);
  }

  /**
   * List all secrets across all integrations (tabla "Credenciales almacenadas")
   */
  async listAllSecrets(): Promise<SecretInfo[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select().from(secretVault).orderBy(desc(secretVault.createdAt));
    return rows.map(toSecretInfo);
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(event: {
    secretId: number;
    integrationId: string;
    userId: number;
    action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "ROTATE" | "EXPORT";
    status: "SUCCESS" | "FAILED" | "DENIED";
    reason?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;
      await db.insert(secretAuditLog).values({
        secretId: event.secretId,
        integrationId: event.integrationId,
        userId: event.userId,
        action: event.action,
        status: event.status,
        reason: event.reason,
        ipAddress: event.ipAddress,
      });
    } catch (error) {
      logger.error("Failed to log audit event:", error);
    }
  }

  /**
   * Get audit logs for a secret
   */
  async getAuditLogs(secretId: number, limit: number = 50): Promise<AuditLogEntry[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select().from(secretAuditLog)
      .where(eq(secretAuditLog.secretId, secretId))
      .orderBy(desc(secretAuditLog.timestamp))
      .limit(limit);
    return rows.map(toAuditEntry);
  }

  /**
   * Get all audit logs
   */
  async getAllAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select().from(secretAuditLog)
      .orderBy(desc(secretAuditLog.timestamp))
      .limit(limit);
    return rows.map(toAuditEntry);
  }

  /**
   * Borra TODO el historial de auditoría de la bóveda (secret_audit_log).
   * Destructivo e irreversible — pensado para limpiar ruido de pruebas en
   * desarrollo, no para uso rutinario en producción (destruye el rastro
   * forense real). Gateado en el router con requirePermission(canDelete).
   */
  async clearAuditLogs(): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Vault no disponible (sin conexión a BD)");
    await db.delete(secretAuditLog);
  }

  /**
   * Check if secrets need rotation
   */
  async getSecretsNeedingRotation(): Promise<SecretInfo[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select().from(secretVault).where(
      and(eq(secretVault.isActive, 1), lte(secretVault.nextRotationAt, new Date())),
    );
    return rows.map(toSecretInfo);
  }
}

let vaultManagerInstance: VaultManager | null = null;

export function getVaultManager(): VaultManager {
  if (!vaultManagerInstance) {
    vaultManagerInstance = new VaultManager();
  }
  return vaultManagerInstance;
}
