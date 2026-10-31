/**
 * mlPredictor.ts — Servicio de predicción ML
 * Lee los resultados ya calculados por scripts/predict/build_predictions.py
 * (tabla predicciones_ml) — sin cómputo estadístico en el request path.
 */

import { asc, eq, desc } from "drizzle-orm";
import { getDb } from "../config/db";
import { prediccionesMl, riesgoClasificacion, riesgoClasificacionMetrics } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import { EDOMEX_CENTROIDES } from "../data/edomexCentroids";

type ClaseRiesgo = "bajo" | "medio" | "alto" | "crítico";

/** riesgo_clasificacion guarda la clase en ASCII ("critico") — un solo
 * punto de mapeo hacia el valor con acento que usa el resto de la app. */
function mapClaseAscii(clase: string): ClaseRiesgo {
  if (clase === "critico") return "crítico";
  if (clase === "bajo" || clase === "medio" || clase === "alto") return clase;
  return "medio";
}

export interface PredictionData {
  municipio: string;
  mes: number;
  anio: number;
  prediccion: number;
  confianza: number;
  tendencia: "al_alza" | "a_la_baja" | "estable";
  intervaloConfianza: {
    minimo: number;
    maximo: number;
  };
}

export interface DesgloseTipo {
  tipo: string;
  modelo: string;
  mapeBacktest: number | null;
  promedioPredictivo: number;
  confianza: number;
}

export interface RiesgoClasificacionInfo {
  clase: ClaseRiesgo;
  confianza: number;
  probabilidades: { bajo: number; medio: number; alto: number; crítico: number };
  modelo: string;
}

export interface ClasificadorMetric {
  modelo: string;
  esGanador: boolean;
  accuracy: number;
  precisionMacro: number;
  recallMacro: number;
  f1Macro: number;
  rocAucMacro: number | null;
  nTest: number;
}

export interface MunicipioPrediction {
  municipio: string;
  predicciones: PredictionData[];
  promedioPredictivo: number;
  tendenciaGeneral: "al_alza" | "a_la_baja" | "estable";
  riesgoProyectado: "bajo" | "medio" | "alto" | "crítico";
  desglose: DesgloseTipo[];
  riesgoClasificacion?: RiesgoClasificacionInfo;
}

/** Forma mínima de una fila de riesgo_clasificacion que necesita la lógica pura. */
export interface RiesgoClasificacionRow {
  clasePredicha: string;
  probaBajo: number;
  probaMedio: number;
  probaAlto: number;
  probaCritico: number;
  modeloGanador: string;
}

/** Forma mínima de una fila de predicciones_ml que necesita la lógica pura. */
export interface PrediccionMlRow {
  municipio: string;
  tipoDelito: string;
  modeloGanador: string;
  mapeBacktest: number | null;
  horizonte: number;
  mesPrediccion: number;
  anioPrediccion: number;
  valorPredicho: number;
  confianza: number;
  intervaloMin: number;
  intervaloMax: number;
}

/**
 * Transforma filas crudas de predicciones_ml (una por tipo de delito x
 * horizonte) en el shape que consume el frontend. Función pura — sin BD,
 * testeable directamente con fixtures.
 */
export function buildMunicipioPrediction(
  municipio: string,
  rows: PrediccionMlRow[],
  meses: number,
  riesgoClasRow?: RiesgoClasificacionRow | null
): MunicipioPrediction | null {
  if (rows.length === 0) return null;

  const horizonteMax = Math.min(meses, 12);
  const porHorizonte = new Map<number, PrediccionMlRow[]>();
  for (const r of rows) {
    if (r.horizonte > horizonteMax) continue;
    const arr = porHorizonte.get(r.horizonte) ?? [];
    arr.push(r);
    porHorizonte.set(r.horizonte, arr);
  }

  const predicciones: PredictionData[] = [];
  for (let h = 1; h <= horizonteMax; h++) {
    const tipos = porHorizonte.get(h);
    if (!tipos || tipos.length === 0) continue;
    const total = tipos.reduce((s, t) => s + t.valorPredicho, 0);
    const minimo = tipos.reduce((s, t) => s + t.intervaloMin, 0);
    const maximo = tipos.reduce((s, t) => s + t.intervaloMax, 0);
    const confianzaProm = Math.round(tipos.reduce((s, t) => s + t.confianza, 0) / tipos.length);
    predicciones.push({
      municipio,
      mes: tipos[0]!.mesPrediccion,
      anio: tipos[0]!.anioPrediccion,
      prediccion: Math.max(0, total),
      confianza: confianzaProm,
      tendencia: "estable",
      intervaloConfianza: {
        minimo: Math.max(0, minimo),
        maximo: Math.max(0, maximo),
      },
    });
  }

  if (predicciones.length === 0) return null;

  const primero = predicciones[0]!.prediccion;
  const ultimo = predicciones[predicciones.length - 1]!.prediccion;
  let tendenciaGeneral: "al_alza" | "a_la_baja" | "estable" = "estable";
  if (primero > 0 && ultimo > primero * 1.1) tendenciaGeneral = "al_alza";
  else if (primero > 0 && ultimo < primero * 0.9) tendenciaGeneral = "a_la_baja";
  for (const p of predicciones) p.tendencia = tendenciaGeneral;

  const promedioPredictivo = Math.round(
    predicciones.reduce((s, p) => s + p.prediccion, 0) / predicciones.length
  );

  // Umbrales fijos — fallback cuando el clasificador aún no corrió para
  // este municipio (scripts/predict/build_riesgo_clasificacion.py). Cuando
  // sí hay clasificación real, se sobreescribe abajo con el modelo entrenado.
  let riesgoProyectado: "bajo" | "medio" | "alto" | "crítico";
  if (promedioPredictivo < 50) riesgoProyectado = "bajo";
  else if (promedioPredictivo < 150) riesgoProyectado = "medio";
  else if (promedioPredictivo < 300) riesgoProyectado = "alto";
  else riesgoProyectado = "crítico";

  let riesgoClasificacion: RiesgoClasificacionInfo | undefined;
  if (riesgoClasRow) {
    const clase = mapClaseAscii(riesgoClasRow.clasePredicha);
    riesgoProyectado = clase;
    const probabilidades = {
      bajo: riesgoClasRow.probaBajo,
      medio: riesgoClasRow.probaMedio,
      alto: riesgoClasRow.probaAlto,
      crítico: riesgoClasRow.probaCritico,
    };
    riesgoClasificacion = {
      clase,
      confianza: Math.max(probabilidades.bajo, probabilidades.medio, probabilidades.alto, probabilidades.crítico),
      probabilidades,
      modelo: riesgoClasRow.modeloGanador,
    };
  }

  const desglosePorTipo = new Map<string, PrediccionMlRow>();
  for (const r of rows) {
    if (r.horizonte === 1) desglosePorTipo.set(r.tipoDelito, r);
  }
  const desglose: DesgloseTipo[] = Array.from(desglosePorTipo.values()).map((r) => ({
    tipo: r.tipoDelito,
    modelo: r.modeloGanador,
    mapeBacktest: r.mapeBacktest,
    promedioPredictivo: r.valorPredicho,
    confianza: r.confianza,
  }));

  return { municipio, predicciones, promedioPredictivo, tendenciaGeneral, riesgoProyectado, desglose, riesgoClasificacion };
}

/**
 * Predice delincuencia para un municipio — lee predicciones_ml, ya
 * calculada por el pipeline offline (scripts/predict/build_predictions.py).
 */
export async function predecirDelincuenciaMunicipio(
  municipio: string,
  meses: number = 3
): Promise<MunicipioPrediction | null> {
  try {
    const db = await getDb();
    if (!db) {
      logger.warn("[ML] Database not available");
      return null;
    }

    const rows = await db
      .select()
      .from(prediccionesMl)
      .where(eq(prediccionesMl.municipio, municipio))
      .orderBy(asc(prediccionesMl.horizonte));

    if (rows.length === 0) {
      logger.warn(
        `[ML] Sin predicciones calculadas para ${municipio} — correr scripts/predict/build_predictions.py`
      );
      return null;
    }

    const riesgoClasRows = await db
      .select()
      .from(riesgoClasificacion)
      .where(eq(riesgoClasificacion.municipio, municipio))
      .limit(1);

    return buildMunicipioPrediction(municipio, rows, meses, riesgoClasRows[0] ?? null);
  } catch (error) {
    logger.error(`[ML] Error predicting for ${municipio}:`, error);
    return null;
  }
}

/**
 * Predice delincuencia para múltiples municipios
 */
export async function predecirDelincuenciaMultiple(
  municipios: string[],
  meses: number = 3
): Promise<MunicipioPrediction[]> {
  const predicciones: MunicipioPrediction[] = [];
  for (const municipio of municipios) {
    const prediccion = await predecirDelincuenciaMunicipio(municipio, meses);
    if (prediccion) predicciones.push(prediccion);
  }
  return predicciones;
}

/**
 * Métricas del torneo de clasificación (Accuracy/Precision/Recall/F1/ROC-AUC
 * por candidato) — transparencia del último run de
 * scripts/predict/build_riesgo_clasificacion.py.
 */
export async function obtenerMetricasClasificador(): Promise<ClasificadorMetric[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(riesgoClasificacionMetrics)
      .orderBy(desc(riesgoClasificacionMetrics.f1Macro));

    return rows.map((r) => ({
      modelo: r.modelo,
      esGanador: r.esGanador === 1,
      accuracy: r.accuracy,
      precisionMacro: r.precisionMacro,
      recallMacro: r.recallMacro,
      f1Macro: r.f1Macro,
      rocAucMacro: r.rocAucMacro,
      nTest: r.nTest,
    }));
  } catch (error) {
    logger.error("[ML] Error fetching classifier metrics:", error);
    return [];
  }
}

/**
 * Obtiene municipios únicos con predicción calculada.
 */
export async function obtenerMunicipios(): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) return EDOMEX_CENTROIDES.map((m) => m.nombre);

    const rows = await db.selectDistinct({ municipio: prediccionesMl.municipio }).from(prediccionesMl);
    const nombres = rows.map((r) => r.municipio).filter((m) => m && m.length > 0);
    return nombres.length > 0 ? nombres : EDOMEX_CENTROIDES.map((m) => m.nombre);
  } catch (error) {
    logger.error("[ML] Error fetching municipalities:", error);
    return EDOMEX_CENTROIDES.map((m) => m.nombre);
  }
}
