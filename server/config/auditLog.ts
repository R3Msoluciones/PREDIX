import { getDb } from "./db";
import { auditLog } from "../../drizzle/schema";
import { logger } from "../_core/logger";

export async function logAudit(entry: {
  userId: number;
  action: string;
  module: string;
  resourceId?: string;
  details?: string;
  ip?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      module: entry.module,
      resourceId: entry.resourceId,
      details: entry.details,
      ipAddress: entry.ip,
    });
  } catch (e) {
    logger.error("[AuditLog] Error al escribir:", e);
  }
}
