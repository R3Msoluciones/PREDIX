/**
 * load-poblacion-inegi.ts — Carga población por municipio desde el Banco de
 * Indicadores de INEGI (indicador 1002000001, Censo de Población y Vivienda
 * 2020). Dato de contexto — no cambia seguido, se sobreescribe completo cada
 * vez que corre (mismo patrón idempotente que scripts/load-sesnsp.ts).
 *
 * Uso: pnpm exec tsx scripts/load-poblacion-inegi.ts
 * Requiere INEGI_API_TOKEN en .env (token gratis).
 */

import "dotenv/config";
import { getDb } from "../server/config/db";
import { poblacionMunicipal } from "../drizzle/schema";
import { EDOMEX_CENTROIDES } from "../server/data/edomexCentroids";

const INDICADOR_POBLACION_TOTAL = "1002000001";
// La API de INEGI acepta varios códigos de área separados por coma en una
// sola llamada, pero falla (404/400) por encima de ~22-24 — verificado
// probando contra la API real, no documentado en ningún lado. 20 deja margen.
const TAMANO_LOTE = 20;

interface InegiObservacion {
  TIME_PERIOD: string;
  OBS_VALUE: string;
  COBER_GEO: string;
}

interface InegiResponse {
  Series: Array<{ OBSERVATIONS: InegiObservacion[] }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchLote(cveMunis: string[], token: string): Promise<Map<string, { poblacion: number; anio: number }>> {
  const areas = cveMunis.join(",");
  const url = `https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/${INDICADOR_POBLACION_TOTAL}/es/${areas}/true/BISE/2.0/${token}?type=json`;

  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok || !text.trim().startsWith("{")) {
    throw new Error(`INEGI API no devolvió JSON válido (status ${res.status}) para [${areas}]: ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text) as InegiResponse;
  const observaciones = data.Series?.[0]?.OBSERVATIONS ?? [];

  const resultado = new Map<string, { poblacion: number; anio: number }>();
  for (const obs of observaciones) {
    resultado.set(obs.COBER_GEO, {
      poblacion: Math.round(parseFloat(obs.OBS_VALUE)),
      anio: parseInt(obs.TIME_PERIOD, 10),
    });
  }
  return resultado;
}

async function fetchPoblacion(cveMunis: string[], token: string): Promise<Map<string, { poblacion: number; anio: number }>> {
  const resultado = new Map<string, { poblacion: number; anio: number }>();
  const lotes = chunk(cveMunis, TAMANO_LOTE);
  for (const [i, lote] of lotes.entries()) {
    console.log(`[poblacion] Lote ${i + 1}/${lotes.length} (${lote.length} municipios)...`);
    const parcial = await fetchLote(lote, token);
    for (const [cve, valor] of parcial) resultado.set(cve, valor);
  }
  return resultado;
}

async function main() {
  const token = process.env.INEGI_API_TOKEN?.trim();
  if (!token) {
    throw new Error("INEGI_API_TOKEN vacío — configúralo en .env antes de correr este script");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("No hay conexión a base de datos (DATABASE_URL). Abortando.");
  }

  console.log(`[poblacion] Consultando población de ${EDOMEX_CENTROIDES.length} municipios en una sola llamada...`);
  const cveMunis = EDOMEX_CENTROIDES.map((m) => m.cveMuni);
  const poblacionPorCve = await fetchPoblacion(cveMunis, token);

  const filas = EDOMEX_CENTROIDES.map((m) => {
    const dato = poblacionPorCve.get(m.cveMuni);
    if (!dato) {
      console.warn(`[poblacion] Sin dato para ${m.nombre} (${m.cveMuni}) — se omite.`);
      return null;
    }
    return {
      cveMuni: m.cveMuni,
      municipio: m.nombre,
      poblacion: dato.poblacion,
      anioCenso: dato.anio,
    };
  }).filter((f): f is NonNullable<typeof f> => f !== null);

  if (filas.length === 0) {
    throw new Error("La API de INEGI no devolvió ningún dato de población — revisa el token o el formato de los códigos de municipio.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(poblacionMunicipal);
    await tx.insert(poblacionMunicipal).values(filas);
  });

  console.log(`[poblacion] ${filas.length} de ${EDOMEX_CENTROIDES.length} municipios guardados en poblacion_municipal.`);
  const totalPoblacion = filas.reduce((sum, f) => sum + f.poblacion, 0);
  console.log(`[poblacion] Población total sumada: ${totalPoblacion.toLocaleString("es-MX")} (año censo: ${filas[0].anioCenso}).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[poblacion] Error:", error);
    process.exit(1);
  });
