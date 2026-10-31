/**
 * Router tRPC para endpoints del dashboard ejecutivo
 * Expone KPIs, tendencias y comparativas
 */

import { router, publicProcedure } from "../_core/infra/trpc";
import { z } from "zod";
import {
  getKPIMetrics,
  getTrendencyData,
  getMonthComparison,
  getCriticalMunicipalities,
  getCrimeTypeStats,
} from "../services/dashboardStats";

export const dashboardRouter = router({
  /**
   * Obtener KPIs del mes actual
   */
  getKPIMetrics: publicProcedure
    .input(
      z
        .object({
          mes: z.number().int().min(1).max(12).optional(),
          anio: z.number().int().min(2015).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const metrics = await getKPIMetrics(input?.mes, input?.anio);
      return {
        success: !!metrics,
        data: metrics,
      };
    }),

  /**
   * Obtener datos de tendencia para gráfico
   */
  getTrendencyData: publicProcedure
    .input(
      z
        .object({
          meses: z.number().int().min(1).max(36).default(12),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const data = await getTrendencyData(input?.meses);
      return {
        success: true,
        data,
      };
    }),

  /**
   * Obtener comparativa mes actual vs mes anterior
   */
  getMonthComparison: publicProcedure.query(async () => {
    const comparison = await getMonthComparison();
    return {
      success: !!comparison,
      data: comparison,
    };
  }),

  /**
   * Obtener municipios críticos
   */
  getCriticalMunicipalities: publicProcedure
    .input(
      z
        .object({
          mes: z.number().int().min(1).max(12).optional(),
          anio: z.number().int().min(2015).optional(),
          limit: z.number().int().min(1).max(50).default(10),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const municipalities = await getCriticalMunicipalities(input?.mes, input?.anio);
      return {
        success: true,
        data: municipalities.slice(0, input?.limit || 10),
      };
    }),

  /**
   * Obtener estadísticas por tipo de delito
   */
  getCrimeTypeStats: publicProcedure
    .input(
      z
        .object({
          mes: z.number().int().min(1).max(12).optional(),
          anio: z.number().int().min(2015).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const stats = await getCrimeTypeStats(input?.mes, input?.anio);
      return {
        success: !!stats,
        data: stats,
      };
    }),

  /**
   * Obtener resumen ejecutivo completo
   */
  getExecutiveSummary: publicProcedure.query(async () => {
    const [metrics, comparison, municipalities, crimeStats, tendencyData] = await Promise.all([
      getKPIMetrics(),
      getMonthComparison(),
      getCriticalMunicipalities(),
      getCrimeTypeStats(),
      getTrendencyData(12),
    ]);

    return {
      success: true,
      data: {
        kpis: metrics,
        comparison,
        criticalMunicipalities: municipalities,
        crimeStats,
        tendencyData,
        timestamp: new Date().toISOString(),
      },
    };
  }),
});
