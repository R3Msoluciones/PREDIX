/**
 * Servicio de estadísticas para el dashboard ejecutivo
 * Calcula KPIs, tendencias y comparativas mes-a-mes
 */

import { getIncidenciaEstatal, getLatestPeriod } from "../data/sesnsp";
import { logger } from "../_core/logger";

export interface KPIMetrics {
  totalIncidentes: number;
  totalVictimas: number;
  municipiosCriticos: number;
  municipiosAltos: number;
  homicidios: number;
  robos: number;
  lesiones: number;
  violenciaSexual: number;
  traficoDeDropas: number;
  otrosDelitos: number;
}

export interface TrendencyData {
  mes: number;
  anio: number;
  delitos: number;
  victimas: number;
  homicidios: number;
  robos: number;
}

export interface ComparativaMes {
  mesActual: {
    mes: number;
    anio: number;
    delitos: number;
    victimas: number;
  };
  mesPasado: {
    mes: number;
    anio: number;
    delitos: number;
    victimas: number;
  };
  cambioDelitos: number;
  cambioVictimas: number;
  porcentajeDelitos: number;
  porcentajeVictimas: number;
}

export interface MunicipioCritico {
  municipio: string;
  delitos: number;
  homicidios: number;
  robos: number;
  victimas: number;
  riesgo: "CRÍTICO" | "ALTO" | "MEDIO" | "BAJO";
  tendencia: "aumentando" | "disminuyendo" | "estable";
}

/**
 * Obtener KPIs del mes actual
 */
export async function getKPIMetrics(mes?: number, anio?: number): Promise<KPIMetrics | null> {
  try {
    const periodo = await getLatestPeriod();
    const mesActual = mes ?? periodo.mes;
    const anioActual = anio ?? periodo.anio;

    const data = await getIncidenciaEstatal(anioActual, mesActual);

    const metrics: KPIMetrics = {
      totalIncidentes: 0,
      totalVictimas: 0,
      municipiosCriticos: 0,
      municipiosAltos: 0,
      homicidios: 0,
      robos: 0,
      lesiones: 0,
      violenciaSexual: 0,
      traficoDeDropas: 0,
      otrosDelitos: 0,
    };

    data.forEach((record) => {
      metrics.homicidios += record.homicidios || 0;
      metrics.robos += record.robos || 0;
      metrics.lesiones += record.lesiones || 0;
      metrics.violenciaSexual += record.violenciaSexual || 0;
      metrics.traficoDeDropas += record.traficoDeDropgas || 0;
      metrics.otrosDelitos += record.otrosDelitos || 0;
      metrics.totalVictimas += record.victimas || 0;
    });

    metrics.totalIncidentes =
      metrics.homicidios +
      metrics.robos +
      metrics.lesiones +
      metrics.violenciaSexual +
      metrics.traficoDeDropas +
      metrics.otrosDelitos;

    // Calcular municipios críticos y altos
    data.forEach((record) => {
      const totalDelitos =
        (record.homicidios || 0) +
        (record.robos || 0) +
        (record.lesiones || 0) +
        (record.violenciaSexual || 0) +
        (record.traficoDeDropgas || 0) +
        (record.otrosDelitos || 0);

      if (totalDelitos > 500 || (record.homicidios || 0) > 50) {
        metrics.municipiosCriticos++;
      } else if (totalDelitos > 300 || (record.homicidios || 0) > 25) {
        metrics.municipiosAltos++;
      }
    });

    return metrics;
  } catch (error) {
    logger.error("Error fetching KPI metrics:", { error });
    return null;
  }
}

/**
 * Obtener datos de tendencia para gráfico de serie temporal
 */
export async function getTrendencyData(
  meses: number = 12
): Promise<TrendencyData[]> {
  try {
    // Serie real (ventana reciente). Se agrupa por mes y se toman los últimos N.
    const data = await getIncidenciaEstatal();

    // Agrupar por mes
    const grouped = new Map<string, TrendencyData>();

    data.forEach((record) => {
      const key = `${record.anio}-${String(record.mes).padStart(2, "0")}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          mes: record.mes,
          anio: record.anio,
          delitos: 0,
          victimas: 0,
          homicidios: 0,
          robos: 0,
        });
      }

      const entry = grouped.get(key)!;
      entry.delitos +=
        (record.homicidios || 0) +
        (record.robos || 0) +
        (record.lesiones || 0) +
        (record.violenciaSexual || 0) +
        (record.traficoDeDropgas || 0) +
        (record.otrosDelitos || 0);
      entry.victimas += record.victimas || 0;
      entry.homicidios += record.homicidios || 0;
      entry.robos += record.robos || 0;
    });

    const serie = Array.from(grouped.values()).sort(
      (a, b) => a.anio - b.anio || a.mes - b.mes
    );
    // Últimos `meses` meses de la serie.
    return serie.slice(-meses);
  } catch (error) {
    logger.error("Error fetching tendency data:", { error });
    return [];
  }
}

/**
 * Obtener comparativa mes actual vs mes anterior
 */
export async function getMonthComparison(): Promise<ComparativaMes | null> {
  try {
    // Último mes con datos vs el mes inmediato anterior (no "hoy", que va vacío).
    const { anio: anioActual, mes: mesActual } = await getLatestPeriod();

    let mesPasado = mesActual - 1;
    let anioPasado = anioActual;
    if (mesPasado < 1) {
      mesPasado = 12;
      anioPasado--;
    }

    const dataMesActual = await getIncidenciaEstatal(anioActual, mesActual);
    const dataMessPasado = await getIncidenciaEstatal(anioPasado, mesPasado);

    const calcularTotales = (data: typeof dataMesActual) => {
      let delitos = 0;
      let victimas = 0;

      data.forEach((record) => {
        delitos +=
          (record.homicidios || 0) +
          (record.robos || 0) +
          (record.lesiones || 0) +
          (record.violenciaSexual || 0) +
          (record.traficoDeDropgas || 0) +
          (record.otrosDelitos || 0);
        victimas += record.victimas || 0;
      });

      return { delitos, victimas };
    };

    const totalesActual = calcularTotales(dataMesActual);
    const totalePasado = calcularTotales(dataMessPasado);

    const cambioDelitos = totalesActual.delitos - totalePasado.delitos;
    const cambioVictimas = totalesActual.victimas - totalePasado.victimas;

    const porcentajeDelitos =
      totalePasado.delitos > 0 ? (cambioDelitos / totalePasado.delitos) * 100 : 0;
    const porcentajeVictimas =
      totalePasado.victimas > 0 ? (cambioVictimas / totalePasado.victimas) * 100 : 0;

    return {
      mesActual: {
        mes: mesActual,
        anio: anioActual,
        delitos: totalesActual.delitos,
        victimas: totalesActual.victimas,
      },
      mesPasado: {
        mes: mesPasado,
        anio: anioPasado,
        delitos: totalePasado.delitos,
        victimas: totalePasado.victimas,
      },
      cambioDelitos,
      cambioVictimas,
      porcentajeDelitos,
      porcentajeVictimas,
    };
  } catch (error) {
    logger.error("Error fetching month comparison:", { error });
    return null;
  }
}

/**
 * Obtener municipios críticos
 */
export async function getCriticalMunicipalities(
  mes?: number,
  anio?: number
): Promise<MunicipioCritico[]> {
  try {
    const periodo = await getLatestPeriod();
    const mesActual = mes ?? periodo.mes;
    const anioActual = anio ?? periodo.anio;

    const data = await getIncidenciaEstatal(anioActual, mesActual);

    const municipiosCriticos: MunicipioCritico[] = data
      .filter((record) => {
        const totalDelitos =
          (record.homicidios || 0) +
          (record.robos || 0) +
          (record.lesiones || 0) +
          (record.violenciaSexual || 0) +
          (record.traficoDeDropgas || 0) +
          (record.otrosDelitos || 0);

        return totalDelitos > 150 || (record.homicidios || 0) > 10;
      })
      .map((record) => {
        const totalDelitos =
          (record.homicidios || 0) +
          (record.robos || 0) +
          (record.lesiones || 0) +
          (record.violenciaSexual || 0) +
          (record.traficoDeDropgas || 0) +
          (record.otrosDelitos || 0);

        let riesgo: "CRÍTICO" | "ALTO" | "MEDIO" | "BAJO";
        if (totalDelitos > 500 || (record.homicidios || 0) > 50) {
          riesgo = "CRÍTICO";
        } else if (totalDelitos > 300 || (record.homicidios || 0) > 25) {
          riesgo = "ALTO";
        } else if (totalDelitos > 150 || (record.homicidios || 0) > 10) {
          riesgo = "MEDIO";
        } else {
          riesgo = "BAJO";
        }

        // Determinar tendencia (simplificada)
        const tendencia: "aumentando" | "disminuyendo" | "estable" = "estable";

        return {
          municipio: record.municipio,
          delitos: totalDelitos,
          homicidios: record.homicidios || 0,
          robos: record.robos || 0,
          victimas: record.victimas || 0,
          riesgo,
          tendencia,
        };
      })
      .sort((a, b) => b.delitos - a.delitos) // Mayor incidencia primero
      .slice(0, 10); // Top 10

    return municipiosCriticos;
  } catch (error) {
    logger.error("Error fetching critical municipalities:", { error });
    return [];
  }
}

/**
 * Obtener estadísticas por tipo de delito
 */
export async function getCrimeTypeStats(mes?: number, anio?: number) {
  try {
    const periodo = await getLatestPeriod();
    const mesActual = mes ?? periodo.mes;
    const anioActual = anio ?? periodo.anio;

    const data = await getIncidenciaEstatal(anioActual, mesActual);

    const stats = {
      homicidios: 0,
      robos: 0,
      lesiones: 0,
      violenciaSexual: 0,
      traficoDeDropas: 0,
      otrosDelitos: 0,
    };

    data.forEach((record) => {
      stats.homicidios += record.homicidios || 0;
      stats.robos += record.robos || 0;
      stats.lesiones += record.lesiones || 0;
      stats.violenciaSexual += record.violenciaSexual || 0;
      stats.traficoDeDropas += record.traficoDeDropgas || 0;
      stats.otrosDelitos += record.otrosDelitos || 0;
    });

    const total = Object.values(stats).reduce((a, b) => a + b, 0);

    return {
      ...stats,
      total,
      porcentajes: {
        homicidios: total > 0 ? (stats.homicidios / total) * 100 : 0,
        robos: total > 0 ? (stats.robos / total) * 100 : 0,
        lesiones: total > 0 ? (stats.lesiones / total) * 100 : 0,
        violenciaSexual: total > 0 ? (stats.violenciaSexual / total) * 100 : 0,
        traficoDeDropas: total > 0 ? (stats.traficoDeDropas / total) * 100 : 0,
        otrosDelitos: total > 0 ? (stats.otrosDelitos / total) * 100 : 0,
      },
    };
  } catch (error) {
    logger.error("Error fetching crime type stats:", { error });
    return null;
  }
}
