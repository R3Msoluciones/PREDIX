import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, incidentAttachments, type InsertIncidentAttachment, type IncidentAttachment } from "../../drizzle/schema";
import { ENV } from '../_core/infra/env';
import { logger } from '../_core/logger';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    logger.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Incident attachments management
export async function addIncidentAttachment(attachment: InsertIncidentAttachment): Promise<IncidentAttachment | null> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot add attachment: database not available");
    return null;
  }

  try {
    const result = await db.insert(incidentAttachments).values(attachment);
    const id = result[0]?.insertId;
    if (id) {
      const inserted = await db.select().from(incidentAttachments).where(eq(incidentAttachments.id, id as number)).limit(1);
      return inserted.length > 0 ? inserted[0] : null;
    }
    return null;
  } catch (error) {
    logger.error("[Database] Failed to add attachment:", error);
    throw error;
  }
}

export async function getIncidentAttachments(incidentId: string): Promise<IncidentAttachment[]> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get attachments: database not available");
    return [];
  }

  try {
    const result = await db.select().from(incidentAttachments).where(eq(incidentAttachments.incidentId, incidentId));
    return result;
  } catch (error) {
    logger.error("[Database] Failed to get attachments:", error);
    return [];
  }
}

export async function deleteIncidentAttachment(attachmentId: number): Promise<IncidentAttachment | null> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot delete attachment: database not available");
    return null;
  }

  try {
    const existing = await db.select().from(incidentAttachments).where(eq(incidentAttachments.id, attachmentId)).limit(1);
    if (existing.length === 0) return null;
    await db.delete(incidentAttachments).where(eq(incidentAttachments.id, attachmentId));
    return existing[0];
  } catch (error) {
    logger.error("[Database] Failed to delete attachment:", error);
    return null;
  }
}

// TODO: add feature queries here as your schema grows.
