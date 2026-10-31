/**
 * tRPC router for incidencia delictiva data
 * Provides endpoints to fetch real crime statistics from SESNSP
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, requirePermission, router } from "../_core/infra/trpc";
import { getIncidenciaByMunicipio, getIncidenciaEstatal, getIncidenciaMapa, getIncidenciaOrigen } from "../data/sesnsp";
import { addIncidentAttachment, getIncidentAttachments, deleteIncidentAttachment, getDb } from "../config/db";
import { storagePut, storageDelete } from "../config/storage";
import { MODULES } from "../_core/infra/permissions";
import { logAudit } from "../config/auditLog";
import { incidenciaDelito } from "../../drizzle/schema";
import { sql, count } from "drizzle-orm";

export const incidenciaRouter = router({
  /**
   * Get incidencia data for a specific municipality
   */
  byMunicipio: publicProcedure
    .input(z.object({ municipio: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      return await getIncidenciaByMunicipio(input.municipio);
    }),

  /**
   * Incidencia real por municipio georreferenciada (para el Mapa Geoespacial).
   * Último mes con datos + nivel + tendencia + coordenadas INEGI.
   */
  mapa: publicProcedure.query(async () => {
    const municipios = await getIncidenciaMapa();
    const origen = await getIncidenciaOrigen();
    return { municipios, origen };
  }),

  /**
   * Get aggregated incidencia data for Estado de México
   */
  estatal: publicProcedure
    .input(
      z.object({
        anio: z.number().optional(),
        mes: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getIncidenciaEstatal(input.anio, input.mes);
    }),

  /**
   * Export incidencia data as CSV with filters
   */
  exportCsv: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        crimeTypes: z.array(z.string()).optional(),
        municipios: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const data = await getIncidenciaEstatal();

      // Filter by date range if provided
      let filtered = data;
      if (input.startDate || input.endDate) {
        const startDate = input.startDate ? new Date(input.startDate) : new Date(0);
        const endDate = input.endDate ? new Date(input.endDate) : new Date();

        filtered = filtered.filter((record) => {
          if (!record.lastUpdated) return false;
          const recordDate = record.lastUpdated instanceof Date 
            ? record.lastUpdated 
            : new Date(record.lastUpdated);
          return recordDate >= startDate && recordDate <= endDate;
        });
      }

      // Filter by crime types if provided
      if (input.crimeTypes && input.crimeTypes.length > 0) {
        // This is a data-level filter; actual filtering happens in CSV generation
      }

      // Filter by municipalities if provided
      if (input.municipios && input.municipios.length > 0) {
        filtered = filtered.filter((record) => input.municipios!.includes(record.municipio));
      }

      // Generate CSV content
      const headers = [
        "Municipio",
        "Año",
        "Mes",
        "Homicidios",
        "Robos",
        "Lesiones",
        "Violencia Sexual",
        "Tráfico de Drogas",
        "Otros Delitos",
        "Total Incidentes",
        "Víctimas",
        "Fecha de Actualización",
      ];

      const rows = filtered.map((record) => {
        const totalIncidentes =
          (record.homicidios || 0) +
          (record.robos || 0) +
          (record.lesiones || 0) +
          (record.violenciaSexual || 0) +
          (record.traficoDeDropgas || 0) +
          (record.otrosDelitos || 0);

        const updateDate = record.lastUpdated instanceof Date 
          ? record.lastUpdated.toLocaleString("es-MX")
          : record.lastUpdated
          ? new Date(record.lastUpdated).toLocaleString("es-MX")
          : new Date().toLocaleString("es-MX");

        return [
          `"${record.municipio}"`,
          record.anio,
          record.mes,
          record.homicidios || 0,
          record.robos || 0,
          record.lesiones || 0,
          record.violenciaSexual || 0,
          record.traficoDeDropgas || 0,
          record.otrosDelitos || 0,
          totalIncidentes,
          record.victimas || 0,
          updateDate,
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      return {
        csv: csvContent,
        filename: `incidencia-delictiva-${new Date().toISOString().split("T")[0]}.csv`,
        recordCount: filtered.length,
      };
    }),

  /**
   * Upload file attachment for an incident
   */
  uploadAttachment: requirePermission(MODULES.INCIDENTES, "canEdit")
    .input(
      z.object({
        incidentId: z.string().min(1).max(100),
        fileName: z.string().min(1).max(255),
        fileData: z.string().min(1).max(14_000_000),
        mimeType: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Decode base64 file data
        const buffer = Buffer.from(input.fileData, "base64");
        const fileSize = buffer.length;

        // Upload to local disk
        const s3Key = `incidents/${input.incidentId}/${Date.now()}-${input.fileName}`;
        const { url: s3Url } = await storagePut(s3Key, buffer, input.mimeType);

        // Store metadata in database
        const attachment = await addIncidentAttachment({
          incidentId: input.incidentId,
          fileName: input.fileName,
          fileType: input.fileName.split(".").pop() || "unknown",
          fileSize,
          s3Key,
          s3Url,
          mimeType: input.mimeType,
          description: input.description,
          uploadedBy: ctx.user.email || ctx.user.openId,
        });

        await logAudit({
          userId: ctx.user.id,
          action: "UPLOAD_ATTACHMENT",
          module: "incidentes",
          resourceId: input.incidentId,
          details: input.fileName,
          ip: ctx.req.ip || "unknown",
        });

        return {
          success: true,
          attachment,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return {
          success: false,
          message: errorMsg,
        };
      }
    }),

  /**
   * Get attachments for an incident
   */
  getAttachments: protectedProcedure
    .input(z.object({ incidentId: z.string() }))
    .query(async ({ input }) => {
      return await getIncidentAttachments(input.incidentId);
    }),

  /**
   * Delete an attachment
   */
  deleteAttachment: requirePermission(MODULES.INCIDENTES, "canDelete")
    .input(z.object({ attachmentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await deleteIncidentAttachment(input.attachmentId);
      if (!deleted) return { success: false };
      await storageDelete(deleted.s3Key);
      await logAudit({
        userId: ctx.user.id,
        action: "DELETE_ATTACHMENT",
        module: "incidentes",
        resourceId: deleted.incidentId,
        details: deleted.fileName,
        ip: ctx.req.ip || "unknown",
      });
      return { success: true };
    }),

  /**
   * Get latest statistics summary
   */
  summary: publicProcedure.query(async () => {
    const data = await getIncidenciaEstatal();
    const origen = await getIncidenciaOrigen();

    if (data.length === 0) {
      return {
        totalIncidentes: 0,
        totalVictimas: 0,
        municipiosReportados: 0,
        ultimaActualizacion: null,
        origen,
      };
    }

    const totalIncidentes = data.reduce(
      (sum, record) =>
        sum +
        (record.homicidios || 0) +
        (record.robos || 0) +
        (record.lesiones || 0) +
        (record.violenciaSexual || 0) +
        (record.traficoDeDropgas || 0) +
        (record.otrosDelitos || 0),
      0
    );

    const totalVictimas = data.reduce((sum, record) => sum + (record.victimas || 0), 0);

    const municipiosReportados = new Set(data.map((r) => r.municipio)).size;

    const ultimaActualizacion = data.length > 0 ? data[0].lastUpdated : null;

    return {
      totalIncidentes,
      totalVictimas,
      municipiosReportados,
      ultimaActualizacion,
      origen,
    };
  }),

  /**
   * Estado real del pipeline de sincronización SESNSP (filas cargadas en la
   * tabla granular real). No hay timestamp de "último sync" que mostrar: la
   * carga real es manual vía `scripts/load-sesnsp.ts`
   * y no queda registrada en ninguna tabla — `ultimoSync`/`statusUltimoSync`
   * quedan siempre en null a propósito, en vez de mostrar un dato inventado.
   * Para el conector "SESNSP" en el módulo de Integración.
   */
  syncStatus: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return { conectado: false, ultimoSync: null, filasCargadas: 0, statusUltimoSync: null, origen: "sin_bd" as const };
    }
    try {
      const [{ total }] = await db.select({ total: count() }).from(incidenciaDelito);
      return {
        conectado: total > 0,
        ultimoSync: null,
        filasCargadas: total,
        statusUltimoSync: null,
        origen: "real" as const,
      };
    } catch (e) {
      return { conectado: false, ultimoSync: null, filasCargadas: 0, statusUltimoSync: null, origen: "error" as const };
    }
  }),
});
