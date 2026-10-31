/**
 * Hook para consumir datos de incidencia delictiva desde la API tRPC
 * Proporciona datos reales del SESNSP con caché automático
 */

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export interface IncidenciaRecord {
  id: number;
  estado: string;
  municipio: string;
  codigoMunicipio?: string;
  anio: number;
  mes: number;
  homicidios: number;
  robos: number;
  lesiones: number;
  violenciaSexual: number;
  traficoDeDropgas: number;
  otrosDelitos: number;
  victimas: number;
  fuero: string;
  lastUpdated: Date;
  sourceUrl?: string;
}

export interface IncidenciaSummary {
  totalIncidentes: number;
  totalVictimas: number;
  municipiosReportados: number;
  ultimaActualizacion: Date | null;
  // Fase 3: origen del dato para el badge honesto (real = tabla granular poblada).
  origen: "real" | "simulado";
}

/**
 * Hook para obtener datos de incidencia estatal
 */
export function useIncidenciaEstatal() {
  const { data, isLoading, error } = trpc.incidencia.estatal.useQuery({} as any);

  return {
    data: (data || []) as IncidenciaRecord[],
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook para obtener datos de incidencia por municipio
 */
export function useIncidenciaByMunicipio(municipio: string) {
  const { data, isLoading, error } = trpc.incidencia.byMunicipio.useQuery(
    { municipio },
    { enabled: !!municipio } as any
  );

  return {
    data: (data || []) as IncidenciaRecord[],
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook para obtener resumen de incidencia
 */
export function useIncidenciaSummary() {
  const { data, isLoading, error } = trpc.incidencia.summary.useQuery({} as any);

  return {
    data: (data || {
      totalIncidentes: 0,
      totalVictimas: 0,
      municipiosReportados: 0,
      ultimaActualizacion: null,
      origen: "simulado",
    }) as IncidenciaSummary,
    isLoading,
    error: error?.message,
  };
}

export interface MapaMunicipioReal {
  municipio: string;
  codigoMunicipio: string;
  lat: number;
  lng: number;
  incidentes: number;
  nivel: "crítico" | "alto" | "medio" | "bajo";
  tendencia: number;
}

/**
 * Hook para el Mapa Geoespacial: incidencia real por municipio (último mes)
 * georreferenciada, con nivel/tendencia y bandera de origen.
 */
export function useIncidenciaMapa() {
  const { data, isLoading, error } = trpc.incidencia.mapa.useQuery(undefined as any);
  return {
    municipios: (data?.municipios ?? []) as MapaMunicipioReal[],
    origen: (data?.origen ?? "simulado") as "real" | "simulado",
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook para procesar datos de incidencia en formatos útiles
 */
export function useProcessedIncidenciaData(data: IncidenciaRecord[]) {
  const [processed, setProcessed] = useState({
    totalIncidentes: 0,
    totalVictimas: 0,
    byType: {} as Record<string, number>,
    byMunicipio: {} as Record<string, number>,
    timeSeries: [] as Array<{ mes: number; anio: number; incidentes: number }>,
  } as any);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const byType: Record<string, number> = {
      homicidios: 0,
      robos: 0,
      lesiones: 0,
      violenciaSexual: 0,
      traficoDeDropgas: 0,
      otrosDelitos: 0,
    };

    const byMunicipio: Record<string, number> = {};
    let totalIncidentes = 0;
    let totalVictimas = 0;

    data.forEach((record) => {
      byType.homicidios += record.homicidios || 0;
      byType.robos += record.robos || 0;
      byType.lesiones += record.lesiones || 0;
      byType.violenciaSexual += record.violenciaSexual || 0;
      byType.traficoDeDropgas += record.traficoDeDropgas || 0;
      byType.otrosDelitos += record.otrosDelitos || 0;

      const municipioTotal =
        (record.homicidios || 0) +
        (record.robos || 0) +
        (record.lesiones || 0) +
        (record.violenciaSexual || 0) +
        (record.traficoDeDropgas || 0) +
        (record.otrosDelitos || 0);

      byMunicipio[record.municipio] = (byMunicipio[record.municipio] || 0) + municipioTotal;

      totalIncidentes += municipioTotal;
      totalVictimas += record.victimas || 0;
    });

    setProcessed({
      totalIncidentes,
      totalVictimas,
      byType,
      byMunicipio,
      timeSeries: [],
    });
  }, [data]);

  return processed;
}
