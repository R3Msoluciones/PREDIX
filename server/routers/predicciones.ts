/**
 * predicciones.ts — Procedimientos tRPC para predicciones ML
 * Expone funcionalidad de predicción a través de tRPC
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/infra/trpc";
import {
  predecirDelincuenciaMunicipio,
  predecirDelincuenciaMultiple,
  obtenerMunicipios,
  obtenerMetricasClasificador,
  type MunicipioPrediction,
} from "../services/mlPredictor";
import { CENTROIDE_POR_NOMBRE } from "../data/edomexCentroids";

export const prediccionesRouter = router({
  // Obtener predicción para un municipio específico
  predecirMunicipio: publicProcedure
    .input(
      z.object({
        municipio: z.string().min(1),
        meses: z.number().int().min(1).max(12).default(3),
      })
    )
    .query(async ({ input }) => {
      const prediccion = await predecirDelincuenciaMunicipio(input.municipio, input.meses);

      if (!prediccion) {
        return {
          success: false,
          message: "No se pudo generar predicción para este municipio",
          data: null,
        };
      }

      return {
        success: true,
        message: "Predicción generada correctamente",
        data: prediccion,
      };
    }),

  // Obtener predicciones para múltiples municipios
  predecirMultiples: publicProcedure
    .input(
      z.object({
        municipios: z.array(z.string().min(1)),
        meses: z.number().int().min(1).max(12).default(3),
      })
    )
    .query(async ({ input }) => {
      const predicciones = await predecirDelincuenciaMultiple(input.municipios, input.meses);

      return {
        success: true,
        message: `${predicciones.length} predicciones generadas`,
        data: predicciones,
      };
    }),

  // Obtener predicciones para todos los municipios
  predecirTodos: publicProcedure
    .input(
      z.object({
        meses: z.number().int().min(1).max(12).default(3),
      })
    )
    .query(async ({ input }) => {
      const municipios = await obtenerMunicipios();

      if (municipios.length === 0) {
        return {
          success: false,
          message: "No hay municipios disponibles",
          data: [],
        };
      }

      const predicciones = await predecirDelincuenciaMultiple(municipios, input.meses);

      return {
        success: true,
        message: `${predicciones.length} predicciones generadas para ${municipios.length} municipios`,
        data: predicciones,
      };
    }),

  // Obtener lista de municipios
  obtenerMunicipios: publicProcedure.query(async () => {
    const municipios = await obtenerMunicipios();

    return {
      success: true,
      message: `${municipios.length} municipios encontrados`,
      data: municipios,
    };
  }),

  // Métricas del torneo de clasificación de riesgo (Accuracy/Precision/Recall/F1/ROC-AUC)
  metricasClasificador: publicProcedure.query(async () => {
    const metricas = await obtenerMetricasClasificador();

    return {
      success: true,
      message: `${metricas.length} modelos evaluados`,
      data: metricas,
    };
  }),

  // Obtener predicción con análisis de riesgo
  analizarRiesgo: publicProcedure
    .input(
      z.object({
        municipio: z.string().min(1),
        meses: z.number().int().min(1).max(12).default(3),
      })
    )
    .query(async ({ input }) => {
      const prediccion = await predecirDelincuenciaMunicipio(input.municipio, input.meses);

      if (!prediccion) {
        return {
          success: false,
          message: "No se pudo analizar el riesgo",
          data: null,
        };
      }

      // Calcular indicadores de riesgo
      const promedioPredictivo = prediccion.promedioPredictivo;
      const tendenciaGeneral = prediccion.tendenciaGeneral;
      const riesgoProyectado = prediccion.riesgoProyectado;

      // Calcular cambio porcentual
      const prediccionesOrdenadas = prediccion.predicciones.map((p) => p.prediccion);
      const primeraMes = prediccionesOrdenadas[0] || 0;
      const ultimaMes = prediccionesOrdenadas[prediccionesOrdenadas.length - 1] || 0;
      const cambioProcentual = primeraMes > 0 ? ((ultimaMes - primeraMes) / primeraMes) * 100 : 0;

      return {
        success: true,
        message: "Análisis de riesgo completado",
        data: {
          municipio: input.municipio,
          riesgoProyectado,
          tendenciaGeneral,
          promedioPredictivo,
          cambioProcentual: Math.round(cambioProcentual),
          predicciones: prediccion.predicciones,
          desglose: prediccion.desglose,
          riesgoClasificacion: prediccion.riesgoClasificacion,
          recomendaciones: generarRecomendaciones(riesgoProyectado, tendenciaGeneral),
        },
      };
    }),

  // Obtener datos para mapa de calor (heatmap)
  obtenerDatosHeatmap: publicProcedure.query(async () => {
    const municipios = await obtenerMunicipios();
    const predicciones = await predecirDelincuenciaMultiple(municipios, 1);

    const heatmapData = predicciones
      .map((pred) => {
        const c = CENTROIDE_POR_NOMBRE[pred.municipio];
        if (!c) return null;

        const riesgo = pred.riesgoProyectado;
        let weight = 0.3;
        if (riesgo === "alto") weight = 0.6;
        if (riesgo === "crítico") weight = 1.0;

        return {
          lat: c.lat,
          lng: c.lng,
          weight,
          municipio: pred.municipio,
          riesgo,
        };
      })
      .filter((d) => d !== null);

    return {
      success: true,
      message: "Datos de heatmap obtenidos",
      data: heatmapData,
    };
  }),

  // Obtener datos geoespaciales de municipios
  obtenerDatosGeoespaciales: publicProcedure.query(async () => {
    const municipios = await obtenerMunicipios();
    const predicciones = await predecirDelincuenciaMultiple(municipios, 1);

    const datosGeoespaciales = predicciones
      .map((pred) => {
        const c = CENTROIDE_POR_NOMBRE[pred.municipio];
        if (!c) return null;

        return {
          municipio: pred.municipio,
          lat: c.lat,
          lng: c.lng,
          poblacion: 0,
          riesgo: pred.riesgoProyectado,
          tendencia: pred.tendenciaGeneral,
          promedio: pred.promedioPredictivo,
        };
      })
      .filter((d) => d !== null);

    return {
      success: true,
      message: "Datos geoespaciales obtenidos",
      data: datosGeoespaciales,
    };
  }),
});

/**
 * Genera recomendaciones basadas en riesgo y tendencia
 */
function generarRecomendaciones(
  riesgo: "bajo" | "medio" | "alto" | "crítico",
  tendencia: "al_alza" | "a_la_baja" | "estable"
): string[] {
  const recomendaciones: string[] = [];

  // Recomendaciones por riesgo
  switch (riesgo) {
    case "crítico":
      recomendaciones.push("ALERTA CRÍTICA: Aumentar presencia policial inmediata");
      recomendaciones.push("Activar protocolos de emergencia y coordinación interinstitucional");
      recomendaciones.push("Considerar toque de queda o restricciones de circulación");
      break;
    case "alto":
      recomendaciones.push("Aumentar patrullaje y vigilancia en zonas de riesgo");
      recomendaciones.push("Intensificar operativos de seguridad preventiva");
      recomendaciones.push("Coordinar con autoridades locales para refuerzo");
      break;
    case "medio":
      recomendaciones.push("Mantener vigilancia constante en puntos críticos");
      recomendaciones.push("Realizar operativos de prevención regularmente");
      break;
    case "bajo":
      recomendaciones.push("Mantener vigilancia estándar");
      recomendaciones.push("Continuar con programas de prevención comunitaria");
      break;
  }

  // Recomendaciones por tendencia
  switch (tendencia) {
    case "al_alza":
      recomendaciones.push("TENDENCIA ASCENDENTE: Implementar medidas preventivas adicionales");
      recomendaciones.push("Investigar causas del incremento delictivo");
      break;
    case "a_la_baja":
      recomendaciones.push("Tendencia positiva: Mantener estrategias actuales");
      recomendaciones.push("Documentar y replicar medidas exitosas");
      break;
    case "estable":
      recomendaciones.push("Situación estable: Continuar monitoreo regular");
      break;
  }

  return recomendaciones;
}
