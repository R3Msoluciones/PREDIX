import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { requirePermission, router } from "../_core/infra/trpc";
import { getDb } from "../config/db";
import { auditLog, users } from "../../drizzle/schema";
import { MODULES } from "../_core/infra/permissions";
import { desc, and, gte, lt, sql, inArray } from "drizzle-orm";
import { logger } from "../_core/logger";
import { listAllRolePermissions, updateRolePermission, resetRolePermissions, getPermissionsOrigin, ROLE_NAMES, MODULE_NAMES } from "../services/permissionsCache";
import { logAudit } from "../config/auditLog";

export const adminRouter = router({
  auditLog: requirePermission(MODULES.ADMIN, "canView").query(async () => {
    const db = await getDb();
    if (!db) return { data: [], origen: "sin_bd" as const };
    try {
      const rows = await db.select().from(auditLog).orderBy(desc(auditLog.timestamp)).limit(200);
      return { data: rows, origen: "real" as const };
    } catch (e) {
      logger.error("[Admin] Error listing audit log:", e);
      return { data: [], origen: "error" as const };
    }
  }),

  /**
   * Matriz completa de permisos por rol — fuente real (role_permissions,
   * con DEFAULT_PERMISSIONS como respaldo si la tabla está vacía o sin BD).
   * Esto es lo mismo que consulta requirePermission en cada request.
   */
  listRolePermissions: requirePermission(MODULES.ADMIN, "canView").query(async () => {
    const matrix = await listAllRolePermissions();
    const origen = await getPermissionsOrigin();
    return { roles: ROLE_NAMES, modules: MODULE_NAMES, matrix, origen };
  }),

  /**
   * Actualiza un permiso (rol x módulo x acción) — afecta la autorización
   * real del sistema de inmediato (invalida el caché que usa requirePermission).
   */
  updateRolePermission: requirePermission(MODULES.ADMIN, "canEdit")
    .input(z.object({
      role: z.enum(ROLE_NAMES as [string, ...string[]]),
      module: z.enum(MODULE_NAMES as [string, ...string[]]),
      canView: z.boolean(),
      canEdit: z.boolean(),
      canDelete: z.boolean(),
      canExport: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Evita el auto-bloqueo: sin esto, un admin podría quitarse a sí mismo
      // (y a todo el rol admin) el acceso al propio módulo de Administración
      // sin ninguna forma de revertirlo salvo editar la BD directo.
      if (input.role === "admin" && input.module === MODULES.ADMIN && (!input.canView || !input.canEdit)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se puede quitar acceso de Ver/Editar al rol admin sobre el módulo de Administración — dejaría a todos los administradores sin poder revertirlo.",
        });
      }
      await updateRolePermission(input.role, input.module, {
        canView: input.canView ? 1 : 0,
        canEdit: input.canEdit ? 1 : 0,
        canDelete: input.canDelete ? 1 : 0,
        canExport: input.canExport ? 1 : 0,
      });
      await logAudit({
        userId: ctx.user.id,
        action: "UPDATE_ROLE_PERMISSION",
        module: "administracion",
        resourceId: `${input.role}:${input.module}`,
        details: `canView=${input.canView} canEdit=${input.canEdit} canDelete=${input.canDelete} canExport=${input.canExport}`,
        ip: ctx.req.ip || "unknown",
      });
      return { success: true };
    }),

  /** Restablece los permisos de un rol a los valores por defecto del sistema. */
  resetRolePermissions: requirePermission(MODULES.ADMIN, "canEdit")
    .input(z.object({ role: z.enum(ROLE_NAMES as [string, ...string[]]) }))
    .mutation(async ({ input, ctx }) => {
      await resetRolePermissions(input.role);
      await logAudit({
        userId: ctx.user.id,
        action: "RESET_ROLE_PERMISSIONS",
        module: "administracion",
        resourceId: input.role,
        details: "Restablecido a valores por defecto",
        ip: ctx.req.ip || "unknown",
      });
      return { success: true };
    }),

  /**
   * Actividad real por módulo y usuarios más activos — derivado de audit_log
   * (acciones de escritura ya registradas: alertas/incidentes/usuarios/vault/
   * chatbot/administración). No mide "vistas" de página ni duración de sesión
   * — esos datos no existen en ningún lado del sistema; solo acciones que
   * generan una mutación real. Ventana de 30 días, con tendencia contra los
   * 30 días previos.
   */
  activityStats: requirePermission(MODULES.ADMIN, "canView").query(async () => {
    const db = await getDb();
    if (!db) return { porModulo: [], usuariosActivos: [], origen: "sin_bd" as const, periodoDias: 30 };

    try {
      const ahora = new Date();
      const inicioActual = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      const inicioAnterior = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);

      const actualPorModulo = await db
        .select({
          module: auditLog.module,
          acciones: sql<number>`count(*)`.mapWith(Number),
          usuarios: sql<number>`count(distinct ${auditLog.userId})`.mapWith(Number),
        })
        .from(auditLog)
        .where(gte(auditLog.timestamp, inicioActual))
        .groupBy(auditLog.module);

      const anteriorPorModulo = await db
        .select({
          module: auditLog.module,
          acciones: sql<number>`count(*)`.mapWith(Number),
        })
        .from(auditLog)
        .where(and(gte(auditLog.timestamp, inicioAnterior), lt(auditLog.timestamp, inicioActual)))
        .groupBy(auditLog.module);

      const anteriorMap = new Map(anteriorPorModulo.map(r => [r.module, r.acciones]));

      const porModulo = actualPorModulo
        .map(r => {
          const previo = anteriorMap.get(r.module) ?? 0;
          const tendencia = previo === 0 ? (r.acciones > 0 ? 100 : 0) : Math.round(((r.acciones - previo) / previo) * 1000) / 10;
          return { module: r.module, acciones: r.acciones, usuariosUnicos: r.usuarios, tendencia };
        })
        .sort((a, b) => b.acciones - a.acciones);

      const topUsuariosRaw = await db
        .select({
          userId: auditLog.userId,
          acciones: sql<number>`count(*)`.mapWith(Number),
        })
        .from(auditLog)
        .where(gte(auditLog.timestamp, inicioActual))
        .groupBy(auditLog.userId)
        .orderBy(sql`count(*) desc`)
        .limit(5);

      const userIds = topUsuariosRaw.map(u => u.userId);
      const userRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
      const userMap = new Map(userRows.map(u => [u.id, u]));

      const usuariosActivos = topUsuariosRaw.map(u => {
        const info = userMap.get(u.userId);
        return {
          userId: u.userId,
          nombre: info?.name || `Usuario #${u.userId}`,
          rol: info?.institutionalRole ?? null,
          acciones: u.acciones,
        };
      });

      return { porModulo, usuariosActivos, origen: "real" as const, periodoDias: 30 };
    } catch (e) {
      logger.error("[Admin] Error calculando actividad:", e);
      return { porModulo: [], usuariosActivos: [], origen: "error" as const, periodoDias: 30 };
    }
  }),
});
