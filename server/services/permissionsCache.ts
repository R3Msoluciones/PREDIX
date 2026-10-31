/**
 * Caché de permisos por rol — fuente real para requirePermission() y para
 * los endpoints de auth.ts que antes leían directo el objeto estático
 * DEFAULT_PERMISSIONS. La tabla `role_permissions` (drizzle/schema.ts)
 * existía desde hace tiempo pero nunca se conectó — este servicio la usa
 * como fuente de verdad, con DEFAULT_PERMISSIONS como respaldo cuando la
 * BD no está disponible o la tabla está vacía (nunca sembrada).
 *
 * Se cachea en memoria (una sola query por arranque del proceso, o hasta
 * la siguiente invalidación) porque requirePermission corre en cada
 * request protegido — no se puede pagar una consulta a BD por cada uno.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../config/db";
import { rolePermissions } from "../../drizzle/schema";
import { DEFAULT_PERMISSIONS, MODULES } from "../_core/infra/permissions";
import { logger } from "../_core/logger";

export interface Perms {
  canView: number;
  canEdit: number;
  canDelete: number;
  canExport: number;
}

type RoleName = keyof typeof DEFAULT_PERMISSIONS;
export const ROLE_NAMES = Object.keys(DEFAULT_PERMISSIONS) as RoleName[];
export const MODULE_NAMES = Object.values(MODULES);

let cache: Record<string, Record<string, Perms>> | null = null;
let cacheOrigin: "real" | "fallback" = "fallback";

function defaultsCopy(): Record<string, Record<string, Perms>> {
  const out: Record<string, Record<string, Perms>> = {};
  for (const role of ROLE_NAMES) out[role] = { ...(DEFAULT_PERMISSIONS[role] as Record<string, Perms>) };
  return out;
}

async function loadCache(): Promise<Record<string, Record<string, Perms>>> {
  if (cache) return cache;

  const db = await getDb();
  if (!db) { cacheOrigin = "fallback"; return defaultsCopy(); } // sin BD: no se cachea, reintenta la próxima llamada

  try {
    const rows = await db.select().from(rolePermissions);
    if (rows.length === 0) { cacheOrigin = "fallback"; return defaultsCopy(); }
    const built = defaultsCopy();
    for (const row of rows) {
      if (!built[row.role]) built[row.role] = {};
      built[row.role][row.module] = { canView: row.canView, canEdit: row.canEdit, canDelete: row.canDelete, canExport: row.canExport };
    }
    cache = built;
    cacheOrigin = "real";
    return cache;
  } catch (error) {
    logger.error("[Permissions] Error leyendo role_permissions, usando valores por defecto:", error);
    cacheOrigin = "fallback";
    return defaultsCopy();
  }
}

export function invalidatePermissionsCache(): void {
  cache = null;
}

/** "real" si la última carga vino de role_permissions (sembrada), "fallback" si se usó DEFAULT_PERMISSIONS. */
export async function getPermissionsOrigin(): Promise<"real" | "fallback"> {
  await loadCache();
  return cacheOrigin;
}

export async function getModulePermissions(role: string, module: string): Promise<Perms> {
  const all = await loadCache();
  return all[role]?.[module] ?? { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 };
}

export async function getRolePermissions(role: string): Promise<Record<string, Perms>> {
  const all = await loadCache();
  return all[role] ?? {};
}

export async function listAllRolePermissions(): Promise<Record<string, Record<string, Perms>>> {
  return loadCache();
}

/**
 * Actualiza (o crea, si no existía fila) el permiso de un rol para un
 * módulo. Upsert manual (select→update/insert) porque role_permissions no
 * tiene constraint único en (role, module) — evita depender de una
 * migración nueva para algo que se puede resolver en código.
 */
export async function updateRolePermission(role: string, module: string, perms: Perms): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("BD no disponible");

  const [existing] = await db.select().from(rolePermissions)
    .where(and(eq(rolePermissions.role, role as RoleName), eq(rolePermissions.module, module)));

  if (existing) {
    await db.update(rolePermissions).set(perms).where(eq(rolePermissions.id, existing.id));
  } else {
    await db.insert(rolePermissions).values({ role: role as RoleName, module, ...perms });
  }
  invalidatePermissionsCache();
}

/** Borra las filas personalizadas de un rol — vuelve a caer en DEFAULT_PERMISSIONS. */
export async function resetRolePermissions(role: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("BD no disponible");

  await db.delete(rolePermissions).where(eq(rolePermissions.role, role as RoleName));
  invalidatePermissionsCache();
}

/** Siembra role_permissions con los valores de DEFAULT_PERMISSIONS — usado por el seed script. */
export async function seedDefaultPermissions(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("BD no disponible");

  const rows: Array<{ role: RoleName; module: string } & Perms> = [];
  for (const role of ROLE_NAMES) {
    for (const module of MODULE_NAMES) {
      const perms = (DEFAULT_PERMISSIONS[role] as Record<string, Perms>)[module];
      if (perms) rows.push({ role, module, ...perms });
    }
  }

  await db.delete(rolePermissions);
  await db.insert(rolePermissions).values(rows);
  invalidatePermissionsCache();
  return rows.length;
}
