import { z } from "zod";
import { publicProcedure, requirePermission, router } from "../_core/infra/trpc";
import { getDb } from "../config/db";
import { incidentes } from "../../drizzle/schema";
import { MODULES } from "../_core/infra/permissions";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { logger } from "../_core/logger";
import { logAudit } from "../config/auditLog";
import { emitEvent } from "../services/realtimeService";
import { CENTROIDE_POR_NOMBRE } from "../data/edomexCentroids";

const estadoSchema = z.enum(["en_proceso", "cerrado", "investigacion"]);
const prioridadSchema = z.enum(["baja", "media", "alta", "critica"]);

// CSV formula injection (CWE-1236): si un campo de texto libre (narrativa,
// personal, etc.) empieza con =, +, -, @ o tab, Excel/Sheets lo interpreta
// como fórmula al abrir el CSV — puede ejecutar código o exfiltrar datos.
// Se neutraliza anteponiendo un apóstrofo, el mitigation estándar de OWASP.
export function csvSafe(value: string): string {
  const dangerous = /^[=+\-@\t]/;
  const safe = dangerous.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function nextFolio(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INC-${year}-`;
  const rows = await db
    .select({ folio: incidentes.folio })
    .from(incidentes)
    .where(gte(incidentes.createdAt, new Date(`${year}-01-01`)));
  const maxSeq = rows.reduce((max, r) => {
    const seq = r.folio.startsWith(prefix) ? parseInt(r.folio.slice(prefix.length), 10) : 0;
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export const incidentesRouter = router({
  listar: publicProcedure
    .input(z.object({
      desde: z.string().optional(),
      hasta: z.string().optional(),
      estado: estadoSchema.optional(),
      municipio: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [], origen: "sin_bd" as const };
      try {
        const conditions = [];
        // Ambas fronteras en UTC explícito — evita que desde (UTC medianoche) y
        // hasta (antes calculado con .setHours, en TZ local del proceso) queden
        // en husos distintos dentro del mismo filtro.
        if (input?.desde) conditions.push(gte(incidentes.createdAt, new Date(`${input.desde}T00:00:00.000Z`)));
        if (input?.hasta) conditions.push(lte(incidentes.createdAt, new Date(`${input.hasta}T23:59:59.999Z`)));
        if (input?.estado) conditions.push(eq(incidentes.estado, input.estado));
        if (input?.municipio) conditions.push(eq(incidentes.municipio, input.municipio));
        const rows = await db.select().from(incidentes)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(incidentes.createdAt))
          .limit(200);
        return { data: rows, origen: "real" as const };
      } catch (e) {
        logger.error("[Incidentes] Error listing:", e);
        return { data: [], origen: "error" as const };
      }
    }),

  crear: requirePermission(MODULES.INCIDENTES, "canEdit")
    .input(z.object({
      tipo: z.string().min(1),
      municipio: z.string().min(1),
      colonia: z.string().optional(),
      narrativa: z.string().min(1),
      prioridad: prioridadSchema,
      estado: estadoSchema.optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      personal: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "BD no disponible" };
      const centroide = CENTROIDE_POR_NOMBRE[input.municipio];
      const lat = input.lat ?? centroide?.lat;
      const lng = input.lng ?? centroide?.lng;
      // nextFolio() no es atómico (lee máximo, luego inserta) — dos crear()
      // concurrentes pueden calcular el mismo folio. La constraint UNIQUE en
      // folio hace que el segundo insert falle; reintentamos regenerando el
      // folio en vez de perder el incidente en silencio.
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const folio = await nextFolio(db);
          await db.insert(incidentes).values({
            folio,
            tipo: input.tipo,
            municipio: input.municipio,
            colonia: input.colonia,
            narrativa: input.narrativa,
            prioridad: input.prioridad,
            estado: input.estado ?? "en_proceso",
            lat: lat?.toString(),
            lng: lng?.toString(),
            personal: input.personal,
            createdBy: ctx.user?.email || ctx.user?.openId,
          });
          await logAudit({
            userId: ctx.user.id,
            action: "CREATE_INCIDENTE",
            module: "incidentes",
            resourceId: folio,
            details: `${input.tipo} (${input.municipio})`,
            ip: ctx.req.ip || "unknown",
          });
          emitEvent({
            type: "nuevo_incidente",
            severity: input.prioridad === "critica" ? "critical" : input.prioridad === "alta" ? "warning" : "info",
            title: `Nuevo incidente: ${input.tipo}`,
            message: `${input.municipio} — folio ${folio}`,
            data: { folio, municipio: input.municipio },
          });
          return { success: true, message: "Incidente creado", folio };
        } catch (e) {
          const isDuplicateFolio = (e as { code?: string; errno?: number })?.code === "ER_DUP_ENTRY"
            || (e as { code?: string; errno?: number })?.errno === 1062;
          if (isDuplicateFolio && attempt < MAX_ATTEMPTS) {
            logger.warn(`[Incidentes] Colisión de folio, reintentando (${attempt}/${MAX_ATTEMPTS})`);
            continue;
          }
          logger.error("[Incidentes] Error creating:", e);
          return {
            success: false,
            message: isDuplicateFolio
              ? "Otro incidente se registró al mismo tiempo — intenta de nuevo"
              : "Error al crear incidente",
          };
        }
      }
      return { success: false, message: "Error al crear incidente" };
    }),

  actualizar: requirePermission(MODULES.INCIDENTES, "canEdit")
    .input(z.object({
      id: z.number(),
      estado: estadoSchema.optional(),
      prioridad: prioridadSchema.optional(),
      narrativa: z.string().min(1).optional(),
      personal: z.string().optional(),
      atendido: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      try {
        const { id, atendido, ...rest } = input;
        await db.update(incidentes)
          .set({ ...rest, ...(atendido !== undefined ? { atendido: atendido ? 1 : 0 } : {}) })
          .where(eq(incidentes.id, id));
        await logAudit({
          userId: ctx.user.id,
          action: "UPDATE_INCIDENTE",
          module: "incidentes",
          resourceId: String(id),
          ip: ctx.req.ip || "unknown",
        });
        emitEvent({
          type: "incidente_actualizado",
          severity: "info",
          title: "Incidente actualizado",
          message: `Incidente #${id} — actualización registrada`,
          data: { incidenteId: id },
        });
        return { success: true };
      } catch (e) {
        logger.error("[Incidentes] Error updating:", e);
        return { success: false };
      }
    }),

  eliminar: requirePermission(MODULES.INCIDENTES, "canDelete")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      try {
        await db.delete(incidentes).where(eq(incidentes.id, input.id));
        await logAudit({
          userId: ctx.user.id,
          action: "DELETE_INCIDENTE",
          module: "incidentes",
          resourceId: String(input.id),
          ip: ctx.req.ip || "unknown",
        });
        return { success: true };
      } catch (e) {
        logger.error("[Incidentes] Error deleting:", e);
        return { success: false };
      }
    }),

  exportCsv: requirePermission(MODULES.INCIDENTES, "canExport")
    .input(z.object({
      desde: z.string().optional(),
      hasta: z.string().optional(),
      estado: estadoSchema.optional(),
      municipio: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const headers = ["Folio", "Tipo", "Municipio", "Colonia", "Estado", "Prioridad", "Personal", "Atendido", "Fecha", "Narrativa"];
      if (!db) {
        return { csv: headers.join(","), filename: `incidentes-${new Date().toISOString().split("T")[0]}.csv`, recordCount: 0 };
      }
      try {
        const conditions = [];
        if (input?.desde) conditions.push(gte(incidentes.createdAt, new Date(`${input.desde}T00:00:00.000Z`)));
        if (input?.hasta) conditions.push(lte(incidentes.createdAt, new Date(`${input.hasta}T23:59:59.999Z`)));
        if (input?.estado) conditions.push(eq(incidentes.estado, input.estado));
        if (input?.municipio) conditions.push(eq(incidentes.municipio, input.municipio));
        const rows = await db.select().from(incidentes)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(incidentes.createdAt))
          .limit(2000);
        const csvRows = rows.map(r => [
          csvSafe(r.folio),
          csvSafe(r.tipo),
          csvSafe(r.municipio),
          csvSafe(r.colonia || ""),
          r.estado,
          r.prioridad,
          csvSafe(r.personal || ""),
          r.atendido ? "Sí" : "No",
          new Date(r.createdAt).toLocaleString("es-MX"),
          csvSafe(r.narrativa),
        ].join(","));
        return {
          csv: [headers.join(","), ...csvRows].join("\n"),
          filename: `incidentes-${new Date().toISOString().split("T")[0]}.csv`,
          recordCount: rows.length,
        };
      } catch (e) {
        logger.error("[Incidentes] Error exporting CSV:", e);
        return { csv: headers.join(","), filename: `incidentes-${new Date().toISOString().split("T")[0]}.csv`, recordCount: 0 };
      }
    }),
});
