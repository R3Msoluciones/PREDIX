/**
 * Router tRPC para exportación de reportes ejecutivos
 */

import { router, publicProcedure } from "../_core/infra/trpc";
import { logger } from "../_core/logger";
import { z } from "zod";
import { generateExecutiveReport, generateMunicipalityReport, ReportOptions } from "../services/reportGenerator";

export const reportsRouter = router({
  /**
   * Generar reporte ejecutivo en PDF
   */
  generateExecutiveReport: publicProcedure
    .input(
      z
        .object({
          includeKPIs: z.boolean().default(true),
          includeTrends: z.boolean().default(true),
          includeCriminalTypes: z.boolean().default(true),
          includeCriticalMunicipalities: z.boolean().default(true),
          includeComparison: z.boolean().default(true),
          title: z.string().default("REPORTE EJECUTIVO DE SEGURIDAD PÚBLICA"),
          subtitle: z.string().default("Estado de México"),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      try {
        const options: ReportOptions = input || {};
        const pdfBuffer = await generateExecutiveReport(options);

        // Convertir a base64 para transmisión
        const base64 = pdfBuffer.toString("base64");

        return {
          success: true,
          data: {
            pdf: base64,
            filename: `reporte_ejecutivo_${new Date().toISOString().split("T")[0]}.pdf`,
            size: pdfBuffer.length,
          },
        };
      } catch (error) {
        logger.error("Error generating executive report:", { error });
        return {
          success: false,
          error: "Error al generar el reporte",
        };
      }
    }),

  /**
   * Generar reporte de municipio específico
   */
  generateMunicipalityReport: publicProcedure
    .input(
      z.object({
        municipio: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const pdfBuffer = await generateMunicipalityReport(input.municipio);

        // Convertir a base64 para transmisión
        const base64 = pdfBuffer.toString("base64");

        return {
          success: true,
          data: {
            pdf: base64,
            filename: `reporte_${input.municipio.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
            size: pdfBuffer.length,
          },
        };
      } catch (error) {
        logger.error("Error generating municipality report:", { error });
        return {
          success: false,
          error: "Error al generar el reporte del municipio",
        };
      }
    }),

  /**
   * Obtener opciones de reporte disponibles
   */
  getReportOptions: publicProcedure.query(async () => {
    return {
      success: true,
      data: {
        reportTypes: [
          {
            id: "executive",
            label: "Reporte Ejecutivo Completo",
            description: "Incluye KPIs, tendencias, tipos de delitos y municipios críticos",
            options: {
              includeKPIs: true,
              includeTrends: true,
              includeCriminalTypes: true,
              includeCriticalMunicipalities: true,
              includeComparison: true,
            },
          },
          {
            id: "kpis",
            label: "Solo KPIs",
            description: "Indicadores clave de rendimiento",
            options: {
              includeKPIs: true,
              includeTrends: false,
              includeCriminalTypes: false,
              includeCriticalMunicipalities: false,
              includeComparison: false,
            },
          },
          {
            id: "trends",
            label: "Análisis de Tendencias",
            description: "Tendencias mensuales y comparativas",
            options: {
              includeKPIs: false,
              includeTrends: true,
              includeCriminalTypes: false,
              includeCriticalMunicipalities: false,
              includeComparison: true,
            },
          },
          {
            id: "crimes",
            label: "Análisis de Delitos",
            description: "Distribución por tipo de delito y municipios críticos",
            options: {
              includeKPIs: false,
              includeTrends: false,
              includeCriminalTypes: true,
              includeCriticalMunicipalities: true,
              includeComparison: false,
            },
          },
        ],
      },
    };
  }),
});
