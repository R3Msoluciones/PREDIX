import { z } from "zod";
import { publicProcedure, requirePermission, router } from "../_core/infra/trpc";
import { getDb } from "../config/db";
import { alertas } from "../../drizzle/schema";
import { MODULES } from "../_core/infra/permissions";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { logger } from "../_core/logger";
import { logAudit } from "../config/auditLog";
import { emitEvent } from "../services/realtimeService";
import { CENTROIDE_POR_NOMBRE } from "../data/edomexCentroids";

/**
 * Resuelve la coordenada real de una alerta: usa lat/lng explícitos si vienen
 * (ej. un futuro pin manual del operador), si no cae a la cabecera municipal
 * real; si el nombre no matchea ningún municipio, deja undefined (nunca una
 * posición inventada).
 */
export function resolveAlertaCoords(
  municipio: string,
  lat?: number,
  lng?: number
): { lat?: number; lng?: number } {
  const centroide = CENTROIDE_POR_NOMBRE[municipio];
  return { lat: lat ?? centroide?.lat, lng: lng ?? centroide?.lng };
}

export const alertasRouter = router({
  listar: publicProcedure
    .input(z.object({
      desde: z.string().optional(),
      hasta: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [], origen: "sin_bd" as const };
      try {
        const conditions = [];
        if (input?.desde) conditions.push(gte(alertas.createdAt, new Date(input.desde)));
        if (input?.hasta) {
          const hasta = new Date(input.hasta);
          hasta.setHours(23, 59, 59, 999);
          conditions.push(lte(alertas.createdAt, hasta));
        }
        const rows = await db.select().from(alertas)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(alertas.createdAt))
          .limit(200);
        return { data: rows, origen: "real" as const };
      } catch (e) {
        logger.error("[Alertas] Error listing:", e);
        return { data: [], origen: "error" as const };
      }
    }),

  eliminar: requirePermission(MODULES.ALERTAS, "canDelete")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(alertas).where(eq(alertas.id, input.id));
      await logAudit({
        userId: ctx.user.id,
        action: "DELETE_ALERTA",
        module: "alertas",
        resourceId: String(input.id),
        ip: ctx.req.ip || "unknown",
      });
      return { success: true };
    }),

  crear: requirePermission(MODULES.ALERTAS, "canEdit")
    .input(z.object({
      nivel: z.enum(["critical", "warning", "info"]),
      titulo: z.string().min(1),
      descripcion: z.string().optional(),
      municipio: z.string().min(1),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "BD no disponible" };
      try {
        const { lat, lng } = resolveAlertaCoords(input.municipio, input.lat, input.lng);

        const result = await db.insert(alertas).values({
          nivel: input.nivel,
          titulo: input.titulo,
          descripcion: input.descripcion || "",
          municipio: input.municipio,
          lat: lat?.toString(),
          lng: lng?.toString(),
          unidades: 0,
        });
        await logAudit({
          userId: ctx.user.id,
          action: "CREATE_ALERTA",
          module: "alertas",
          resourceId: String(result[0].insertId),
          details: `${input.titulo} (${input.municipio})`,
          ip: ctx.req.ip || "unknown",
        });
        emitEvent({
          type: "nueva_alerta",
          severity: input.nivel === "critical" ? "critical" : input.nivel === "warning" ? "warning" : "info",
          title: `Nueva alerta: ${input.titulo}`,
          message: `${input.municipio} — nivel ${input.nivel}`,
          data: { alertaId: result[0].insertId, municipio: input.municipio },
        });
        return { success: true, message: "Alerta creada" };
      } catch (e) {
        logger.error("[Alertas] Error creating:", e);
        return { success: false, message: "Error al crear alerta" };
      }
    }),

  reconocer: requirePermission(MODULES.ALERTAS, "canEdit")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(alertas).set({ reconocida: 1 }).where(eq(alertas.id, input.id));
      await logAudit({
        userId: ctx.user.id,
        action: "ACK_ALERTA",
        module: "alertas",
        resourceId: String(input.id),
        ip: ctx.req.ip || "unknown",
      });
      emitEvent({
        type: "alerta_actualizada",
        severity: "info",
        title: "Alerta reconocida",
        message: `Alerta #${input.id} reconocida`,
        data: { alertaId: input.id },
      });
      return { success: true };
    }),

  escalar: requirePermission(MODULES.ALERTAS, "canEdit")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(alertas).set({ escalada: 1, nivel: "critical" }).where(eq(alertas.id, input.id));
      await logAudit({
        userId: ctx.user.id,
        action: "ESCALATE_ALERTA",
        module: "alertas",
        resourceId: String(input.id),
        ip: ctx.req.ip || "unknown",
      });
      emitEvent({
        type: "alerta_actualizada",
        severity: "critical",
        title: "Alerta escalada",
        message: `Alerta #${input.id} escalada a crítica`,
        data: { alertaId: input.id },
      });
      return { success: true };
    }),

  despachar: requirePermission(MODULES.ALERTAS, "canEdit")
    .input(z.object({ id: z.number(), cantidad: z.number().default(2) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const existing = await db.select({ unidades: alertas.unidades }).from(alertas).where(eq(alertas.id, input.id));
      if (existing.length === 0) return { success: false };
      await db.update(alertas).set({ unidades: existing[0].unidades + input.cantidad }).where(eq(alertas.id, input.id));
      await logAudit({
        userId: ctx.user.id,
        action: "DISPATCH_ALERTA",
        module: "alertas",
        resourceId: String(input.id),
        ip: ctx.req.ip || "unknown",
      });
      emitEvent({
        type: "alerta_actualizada",
        severity: "info",
        title: "Unidades despachadas",
        message: `Alerta #${input.id} — ${input.cantidad} unidad(es) despachada(s)`,
        data: { alertaId: input.id },
      });
      return { success: true };
    }),

  resolver: requirePermission(MODULES.ALERTAS, "canEdit")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(alertas).set({ resuelta: 1, nivel: "safe" }).where(eq(alertas.id, input.id));
      await logAudit({
        userId: ctx.user.id,
        action: "RESOLVE_ALERTA",
        module: "alertas",
        resourceId: String(input.id),
        ip: ctx.req.ip || "unknown",
      });
      emitEvent({
        type: "alerta_actualizada",
        severity: "success",
        title: "Alerta resuelta",
        message: `Alerta #${input.id} marcada como resuelta`,
        data: { alertaId: input.id },
      });
      return { success: true };
    }),
});
