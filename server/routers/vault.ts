/**
 * tRPC Router for Vault Operations
 */

import { requirePermission, router, protectedProcedure } from "../_core/infra/trpc";
import { MODULES } from "../_core/infra/permissions";
import { z } from "zod";
import { getVaultManager } from "../services/vault/vaultManager";
import { getEncryptionService } from "../services/vault/encryptionService";
import { logAudit } from "../config/auditLog";

const vaultManager = getVaultManager();
const encryptionService = getEncryptionService();

export const vaultRouter = router({
  /**
   * Store a new secret
   */
  storeSecret: requirePermission(MODULES.ADMIN, "canEdit")
    .input(
      z.object({
        integrationId: z.string().min(1).max(100),
        secretName: z.string().min(1).max(255),
        secretType: z.enum(["API_KEY", "OAUTH_TOKEN", "BASIC_AUTH", "CERTIFICATE", "CUSTOM"]),
        secretValue: z.string().min(1),
        expiresAt: z.date().optional(),
        rotationInterval: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const secretInfo = await vaultManager.storeSecret(
        {
          integrationId: input.integrationId,
          secretName: input.secretName,
          secretType: input.secretType,
          secretValue: input.secretValue,
          expiresAt: input.expiresAt,
          rotationInterval: input.rotationInterval,
        },
        ctx.user.id,
        ctx.req.ip || "unknown"
      );

      return {
        success: true,
        secretId: secretInfo.id,
        message: `Secret "${input.secretName}" stored successfully`,
      };
    }),

  /**
   * Retrieve a secret
   */
  retrieveSecret: requirePermission(MODULES.ADMIN, "canView")
    .input(z.object({ secretId: z.number() }))
    .query(async ({ input, ctx }) => {
      const secretValue = await vaultManager.retrieveSecret(input.secretId, ctx.user.id, ctx.req.ip || "unknown");

      return {
        success: true,
        value: secretValue,
      };
    }),

  /**
   * Update a secret
   */
  updateSecret: requirePermission(MODULES.ADMIN, "canEdit")
    .input(
      z.object({
        secretId: z.number(),
        newValue: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await vaultManager.updateSecret(input.secretId, input.newValue, ctx.user.id, ctx.req.ip || "unknown");

      return {
        success: true,
        message: "Secret updated successfully",
      };
    }),

  /**
   * Rotate a secret (genera un valor nuevo, deja registro forense en secret_rotation_history)
   */
  rotateSecret: requirePermission(MODULES.ADMIN, "canEdit")
    .input(z.object({ secretId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const newValue = encryptionService.generateRandomSecret(32);
      const secretInfo = await vaultManager.rotateSecret(input.secretId, newValue, ctx.user.id, ctx.req.ip || "unknown");

      return {
        success: true,
        data: secretInfo,
        message: "Secret rotated successfully",
      };
    }),

  /**
   * Delete a secret
   */
  deleteSecret: requirePermission(MODULES.ADMIN, "canDelete")
    .input(z.object({ secretId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await vaultManager.deleteSecret(input.secretId, ctx.user.id, ctx.req.ip || "unknown");

      return {
        success: true,
        message: "Secret deleted successfully",
      };
    }),

  /**
   * Get secret metadata
   */
  getSecretInfo: requirePermission(MODULES.ADMIN, "canView")
    .input(z.object({ secretId: z.number() }))
    .query(async ({ input }) => {
      const secretInfo = await vaultManager.getSecretInfo(input.secretId);

      return {
        success: true,
        data: secretInfo,
      };
    }),

  /**
   * List secrets for an integration
   */
  listSecrets: requirePermission(MODULES.ADMIN, "canView")
    .input(z.object({ integrationId: z.string() }))
    .query(async ({ input }) => {
      const secrets = await vaultManager.listSecrets(input.integrationId);

      return {
        success: true,
        data: secrets,
        count: secrets.length,
      };
    }),

  /**
   * List all secrets across all integrations
   */
  listAllSecrets: requirePermission(MODULES.ADMIN, "canView").query(async () => {
    const secrets = await vaultManager.listAllSecrets();

    return {
      success: true,
      data: secrets,
      count: secrets.length,
    };
  }),

  /**
   * Get audit logs for a secret
   */
  getAuditLogs: requirePermission(MODULES.ADMIN, "canView")
    .input(
      z.object({
        secretId: z.number(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const logs = await vaultManager.getAuditLogs(input.secretId, input.limit);

      return {
        success: true,
        data: logs,
        count: logs.length,
      };
    }),

  /**
   * Get all audit logs
   */
  getAllAuditLogs: requirePermission(MODULES.ADMIN, "canView")
    .input(
      z.object({
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const logs = await vaultManager.getAllAuditLogs(input.limit);

      return {
        success: true,
        data: logs,
        count: logs.length,
      };
    }),

  /**
   * Borra todo el historial de auditoría de la bóveda — destructivo, solo canDelete
   */
  clearAuditLogs: requirePermission(MODULES.ADMIN, "canDelete").mutation(async ({ ctx }) => {
    // Se registra en audit_log (tabla separada, no se borra con esto) ANTES de
    // truncar secret_audit_log — de otro modo el borrado de la evidencia
    // forense de la Bóveda quedaría sin ningún rastro de quién lo hizo.
    await logAudit({
      userId: ctx.user.id,
      action: "CLEAR_VAULT_AUDIT_LOG",
      module: "vault",
      details: "Se limpió por completo el historial de auditoría de la Bóveda de Secretos",
      ip: ctx.req.ip || "unknown",
    });
    await vaultManager.clearAuditLogs();
    return { success: true, message: "Auditoría de la bóveda limpiada" };
  }),

  /**
   * Get secrets needing rotation
   */
  getSecretsNeedingRotation: requirePermission(MODULES.ADMIN, "canView").query(async () => {
    const secrets = await vaultManager.getSecretsNeedingRotation();

    return {
      success: true,
      data: secrets,
      count: secrets.length,
    };
  }),

  /**
   * Encrypt data
   */
  encryptData: protectedProcedure
    .input(z.object({ plaintext: z.string() }))
    .mutation(({ input }) => {
      const encrypted = encryptionService.encrypt(input.plaintext);

      return {
        success: true,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        algorithm: encrypted.algorithm,
      };
    }),

  /**
   * Decrypt data
   */
  decryptData: protectedProcedure
    .input(
      z.object({
        encryptedValue: z.string(),
        iv: z.string(),
        authTag: z.string(),
        algorithm: z.string(),
      })
    )
    .mutation(({ input }) => {
      const decrypted = encryptionService.decrypt({
        encryptedValue: input.encryptedValue,
        iv: input.iv,
        authTag: input.authTag,
        algorithm: input.algorithm,
      });

      return {
        success: true,
        value: decrypted.value,
      };
    }),

  /**
   * Generate random secret
   */
  generateRandomSecret: protectedProcedure
    .input(
      z.object({
        length: z.number().default(32),
      })
    )
    .mutation(({ input }) => {
      const secret = encryptionService.generateRandomSecret(input.length);

      return {
        success: true,
        secret: secret,
      };
    }),

  /**
   * Validate encryption data
   */
  validateEncryptionData: protectedProcedure
    .input(
      z.object({
        encryptedValue: z.string(),
        iv: z.string(),
        authTag: z.string(),
      })
    )
    .query(({ input }) => {
      const isValid = encryptionService.validateEncryptionData({
        encryptedValue: input.encryptedValue,
        iv: input.iv,
        authTag: input.authTag,
        algorithm: "aes-256-gcm",
      });

      return {
        success: true,
        isValid: isValid,
      };
    }),
});
