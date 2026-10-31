/**
 * SESNSP Data Integration Service
 * Los datos reales se cargan offline vía `scripts/load-sesnsp.ts` (CSV oficial,
 * MySQL local_infile) a la tabla granular `incidencia_delito` — ver Issue #2 en
 * la documentación del proyecto. Este archivo solo LEE esa tabla (queryRealIncidencia) y sirve un
 * fallback simulado (generateMockSesnspData/getMockIncidenciaTable) cuando no
 * hay BD o la tabla está vacía. No escribe nada por sí mismo.
 */

import { eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "../config/db";
import { incidenciaDelito, incidenciaVictima, IncidenciaDelictiva } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import { EDOMEX_CENTROIDES, CENTROIDE_POR_CVE } from "./edomexCentroids";

// SESNSP data structure mapping
interface SesnspRecord {
  estado: string;
  municipio: string;
  codigoMunicipio?: string;
  anio: number;
  mes: number;
  homicidios?: number;
  robos?: number;
  lesiones?: number;
  violenciaSexual?: number;
  traficoDeDropgas?: number;
  otrosDelitos?: number;
  victimas?: number;
  fuero?: string;
}

/**
 * PRNG determinista (mulberry32) — para que los datos simulados sean
 * estables entre llamadas (summary y estatal deben cuadrar) y no
 * "salten" en cada refetch del cliente.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash estable de un string → semilla, para variar incidencia por municipio.
function strSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generate mock SESNSP data for Estado de México.
 * Cubre los 125 municipios del catálogo (no solo 10) y los últimos 13
 * meses, con valores DETERMINISTAS por municipio+mes. Estructura idéntica
 * a la real para que el rewire de Fase 3 sea un cambio de fuente, no de forma.
 */
function generateMockSesnspData(): SesnspRecord[] {
  const data: SesnspRecord[] = [];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  for (let monthOffset = 12; monthOffset >= 0; monthOffset--) {
    let year = currentYear;
    let month = currentMonth - monthOffset;
    if (month <= 0) {
      year--;
      month += 12;
    }

    for (const muni of EDOMEX_CENTROIDES) {
      const rng = mulberry32(strSeed(`${muni.nombre}-${year}-${month}`));
      const scale = 0.5 + rng() * 1.5;
      const base = Math.floor((rng() * 90 + 25) * scale);

      data.push({
        estado: "Estado de México",
        municipio: muni.nombre,
        codigoMunicipio: muni.cveMuni,
        anio: year,
        mes: month,
        homicidios: Math.round(base * 0.08),
        robos: Math.round(base * 0.35),
        lesiones: Math.round(base * 0.25),
        violenciaSexual: Math.round(base * 0.05),
        traficoDeDropgas: Math.round(base * 0.12),
        otrosDelitos: Math.round(base * 0.15),
        victimas: Math.round(base * 0.9),
        fuero: "comun",
      });
    }
  }

  return data;
}

/**
 * Dataset simulado en forma de tabla (IncidenciaDelictiva) — fallback para
 * MODO DEGRADADO (sin MySQL) y cuando la tabla está vacía. Se cachea a nivel
 * de módulo: estable entre requests, sin recomputar en cada llamada.
 * Así el badge "DATOS SIMULADOS" es verídico aunque no haya BD.
 */
let mockTableCache: IncidenciaDelictiva[] | null = null;
function getMockIncidenciaTable(): IncidenciaDelictiva[] {
  if (mockTableCache) return mockTableCache;
  const now = new Date();
  mockTableCache = generateMockSesnspData().map((r, i) => ({
    id: i + 1,
    estado: r.estado,
    municipio: r.municipio,
    codigoMunicipio: r.codigoMunicipio ?? null,
    anio: r.anio,
    mes: r.mes,
    homicidios: r.homicidios ?? 0,
    robos: r.robos ?? 0,
    lesiones: r.lesiones ?? 0,
    violenciaSexual: r.violenciaSexual ?? 0,
    traficoDeDropgas: r.traficoDeDropgas ?? 0,
    otrosDelitos: r.otrosDelitos ?? 0,
    victimas: r.victimas ?? 0,
    fuero: r.fuero ?? "comun",
    lastUpdated: now,
    sourceUrl: null,
  }));
  return mockTableCache;
}

// ============================================================
// FASE 3 — Lectura de DATOS REALES desde la tabla granular
// `incidencia_delito` (formato largo, 44 tipos). Se proyecta a la forma
// pivoteada `IncidenciaDelictiva` (6 buckets + víctimas) que ya consumen el
// router `incidencia`, el Tablero y el Dashboard — así el rewire cambia la
// fuente, no la forma. Bucketing sin pérdida: `otrosDelitos` = total − los 5.
// ============================================================

/** Bien jurídico que agrupa todos los delitos sexuales. */
const BJ_SEXUAL = "La libertad y la seguridad sexual";
/** Tipos que cuentan como homicidio doloso (incluye feminicidio). */
const TIPOS_HOMICIDIO = ["Homicidio", "Feminicidio"] as const;

/**
 * Construye la lista de condiciones de filtro reutilizable para delito/víctima.
 * `anioMin` aplica la ventana reciente por defecto (sin filtro de año).
 */
function buildDelitoFilters(opts: { anio?: number; mes?: number; municipio?: string; anioMin?: number }) {
  const conds = [];
  if (opts.anio) conds.push(eq(incidenciaDelito.anio, opts.anio));
  if (opts.mes) conds.push(eq(incidenciaDelito.mes, opts.mes));
  if (opts.municipio) conds.push(eq(incidenciaDelito.municipio, opts.municipio));
  if (opts.anioMin && !opts.anio) conds.push(gte(incidenciaDelito.anio, opts.anioMin));
  return conds;
}

/**
 * Agrega las víctimas reales (RNID) por municipio-año-mes → mapa para enlazar.
 */
async function getVictimasMap(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  opts: { anio?: number; mes?: number; municipio?: string; anioMin?: number },
): Promise<Map<string, number>> {
  const conds = [];
  if (opts.anio) conds.push(eq(incidenciaVictima.anio, opts.anio));
  if (opts.mes) conds.push(eq(incidenciaVictima.mes, opts.mes));
  if (opts.municipio) conds.push(eq(incidenciaVictima.municipio, opts.municipio));
  if (opts.anioMin && !opts.anio) conds.push(gte(incidenciaVictima.anio, opts.anioMin));

  const rows = await db
    .select({
      municipio: incidenciaVictima.municipio,
      anio: incidenciaVictima.anio,
      mes: incidenciaVictima.mes,
      victimas: sql<number>`SUM(${incidenciaVictima.cantidad})`.mapWith(Number),
    })
    .from(incidenciaVictima)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(incidenciaVictima.municipio, incidenciaVictima.anio, incidenciaVictima.mes);

  const map = new Map<string, number>();
  for (const r of rows) map.set(`${r.municipio}-${r.anio}-${r.mes}`, r.victimas);
  return map;
}

/**
 * Lee incidencia REAL de `incidencia_delito` y la devuelve en forma
 * `IncidenciaDelictiva` (misma que el mock). Sin filtro de año, limita a los
 * últimos 3 años para mantener el payload acotado y ≥12 meses de histórico.
 * Devuelve [] si no hay BD o la tabla está vacía (el caller hace fallback).
 */
async function queryRealIncidencia(opts: {
  anio?: number;
  mes?: number;
  municipio?: string;
}): Promise<IncidenciaDelictiva[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Ventana reciente por defecto: últimos 3 años (incluye víctimas RNID 2026).
    let anioMin: number | undefined;
    if (!opts.anio) {
      const [maxRow] = await db
        .select({ y: sql<number>`MAX(${incidenciaDelito.anio})`.mapWith(Number) })
        .from(incidenciaDelito);
      if (!maxRow?.y) return []; // tabla vacía
      anioMin = maxRow.y - 2;
    }

    const filters = buildDelitoFilters({ ...opts, anioMin });
    const sexualSql = sql`SUM(CASE WHEN ${incidenciaDelito.bienJuridico} = ${BJ_SEXUAL} THEN ${incidenciaDelito.cantidad} ELSE 0 END)`;
    const homicidioSql = sql`SUM(CASE WHEN ${incidenciaDelito.tipo} IN ('Homicidio','Feminicidio') THEN ${incidenciaDelito.cantidad} ELSE 0 END)`;
    const roboSql = sql`SUM(CASE WHEN ${incidenciaDelito.tipo} = 'Robo' THEN ${incidenciaDelito.cantidad} ELSE 0 END)`;
    const lesionSql = sql`SUM(CASE WHEN ${incidenciaDelito.tipo} = 'Lesiones' THEN ${incidenciaDelito.cantidad} ELSE 0 END)`;
    const narcoSql = sql`SUM(CASE WHEN ${incidenciaDelito.tipo} = 'Narcomenudeo' THEN ${incidenciaDelito.cantidad} ELSE 0 END)`;

    const rows = await db
      .select({
        municipio: incidenciaDelito.municipio,
        codigoMunicipio: incidenciaDelito.cveMuni,
        anio: incidenciaDelito.anio,
        mes: incidenciaDelito.mes,
        total: sql<number>`SUM(${incidenciaDelito.cantidad})`.mapWith(Number),
        homicidios: homicidioSql.mapWith(Number),
        robos: roboSql.mapWith(Number),
        lesiones: lesionSql.mapWith(Number),
        violenciaSexual: sexualSql.mapWith(Number),
        traficoDeDropgas: narcoSql.mapWith(Number),
      })
      .from(incidenciaDelito)
      .where(filters.length ? and(...filters) : undefined)
      .groupBy(
        incidenciaDelito.municipio,
        incidenciaDelito.cveMuni,
        incidenciaDelito.anio,
        incidenciaDelito.mes,
      );

    if (rows.length === 0) return [];

    const victimasMap = await getVictimasMap(db, { ...opts, anioMin });
    const now = new Date();

    return rows.map((r, i) => {
      // otrosDelitos = total − (los 5 buckets explícitos) → suma exacta, sin pérdida.
      const otros =
        r.total - r.homicidios - r.robos - r.lesiones - r.violenciaSexual - r.traficoDeDropgas;
      return {
        id: i + 1,
        estado: "México",
        municipio: r.municipio,
        codigoMunicipio: r.codigoMunicipio,
        anio: r.anio,
        mes: r.mes,
        homicidios: r.homicidios,
        robos: r.robos,
        lesiones: r.lesiones,
        violenciaSexual: r.violenciaSexual,
        traficoDeDropgas: r.traficoDeDropgas,
        otrosDelitos: Math.max(0, otros),
        victimas: victimasMap.get(`${r.municipio}-${r.anio}-${r.mes}`) ?? 0,
        fuero: "comun",
        lastUpdated: now,
        sourceUrl: null,
      };
    });
  } catch (error) {
    logger.error("[SESNSP] Error querying real incidencia:", error);
    return [];
  }
}

/**
 * Último periodo (anio, mes) con datos. Real si la tabla granular está poblada;
 * si no, el más reciente del mock. Los datos SESNSP reales llegan con ~2 meses
 * de rezago, por eso los KPIs no pueden default al "mes de hoy" (saldría vacío).
 */
export async function getLatestPeriod(): Promise<{ anio: number; mes: number }> {
  const db = await getDb();
  if (db) {
    try {
      const [row] = await db
        .select({
          anio: sql<number>`MAX(${incidenciaDelito.anio})`.mapWith(Number),
        })
        .from(incidenciaDelito);
      if (row?.anio) {
        const [m] = await db
          .select({ mes: sql<number>`MAX(${incidenciaDelito.mes})`.mapWith(Number) })
          .from(incidenciaDelito)
          .where(eq(incidenciaDelito.anio, row.anio));
        if (m?.mes) return { anio: row.anio, mes: m.mes };
      }
    } catch (error) {
      logger.error("[SESNSP] Error resolving latest period:", error);
    }
  }
  // Fallback: el mes más reciente del mock.
  const mock = getMockIncidenciaTable();
  return mock.reduce(
    (acc, r) => (r.anio * 100 + r.mes > acc.anio * 100 + acc.mes ? { anio: r.anio, mes: r.mes } : acc),
    { anio: mock[0].anio, mes: mock[0].mes },
  );
}

/**
 * Indica si la incidencia servida proviene de datos reales (tabla granular
 * poblada) o del fallback simulado. Lo usa el badge honesto del Tablero.
 */
export async function getIncidenciaOrigen(): Promise<"real" | "simulado"> {
  const db = await getDb();
  if (!db) return "simulado";
  try {
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(incidenciaDelito);
    return row && row.n > 0 ? "real" : "simulado";
  } catch {
    return "simulado";
  }
}

// ============================================================
// MAPA GEOESPACIAL — incidencia REAL por municipio georreferenciada.
// Une el total del último mes con datos a su centroide INEGI (edomexCentroids)
// y calcula nivel + tendencia vs el mes previo. Lo consume MapaTab/TacticalMap.
// ============================================================

export interface MapaMunicipio {
  municipio: string;
  codigoMunicipio: string;
  lat: number;
  lng: number;
  /** Incidentes (todos los tipos) del último mes con datos. */
  incidentes: number;
  nivel: "crítico" | "alto" | "medio" | "bajo";
  /** Variación % vs el mes inmediato anterior. */
  tendencia: number;
}

// Umbrales calibrados con la distribución real (último mes: max ~2840, p90 ~657).
function nivelPorIncidentes(inc: number): MapaMunicipio["nivel"] {
  if (inc >= 1000) return "crítico";
  if (inc >= 500) return "alto";
  if (inc >= 150) return "medio";
  return "bajo";
}

/**
 * Incidencia real por municipio (último periodo) lista para el mapa.
 * Devuelve [] si no hay BD o datos (el cliente decide el estado vacío).
 */
export async function getIncidenciaMapa(): Promise<MapaMunicipio[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { anio, mes } = await getLatestPeriod();
    let mesPrev = mes - 1;
    let anioPrev = anio;
    if (mesPrev < 1) { mesPrev = 12; anioPrev--; }

    const sumarPorMunicipio = async (a: number, m: number) => {
      const rows = await db
        .select({
          cve: incidenciaDelito.cveMuni,
          inc: sql<number>`SUM(${incidenciaDelito.cantidad})`.mapWith(Number),
        })
        .from(incidenciaDelito)
        .where(and(eq(incidenciaDelito.anio, a), eq(incidenciaDelito.mes, m)))
        .groupBy(incidenciaDelito.cveMuni);
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.cve, r.inc);
      return map;
    };

    const actual = await sumarPorMunicipio(anio, mes);
    if (actual.size === 0) return [];
    const previo = await sumarPorMunicipio(anioPrev, mesPrev);

    const out: MapaMunicipio[] = [];
    for (const [cve, inc] of Array.from(actual.entries())) {
      const centro = CENTROIDE_POR_CVE[cve];
      if (!centro) continue; // sin coordenada → no se puede mapear
      const prev = previo.get(cve) ?? 0;
      const tendencia = prev > 0 ? Math.round(((inc - prev) / prev) * 100) : 0;
      out.push({
        municipio: centro.nombre,
        codigoMunicipio: cve,
        lat: centro.lat,
        lng: centro.lng,
        incidentes: inc,
        nivel: nivelPorIncidentes(inc),
        tendencia,
      });
    }
    return out.sort((a, b) => b.incidentes - a.incidentes);
  } catch (error) {
    logger.error("[SESNSP] Error building mapa data:", error);
    return [];
  }
}

/**
 * Get latest incidencia delictiva data for a specific municipality
 */
export async function getIncidenciaByMunicipio(municipio: string) {
  const db = await getDb();
  // Modo degradado (sin BD): servir simulado para que la UI no quede vacía.
  if (!db) return getMockIncidenciaTable().filter((r) => r.municipio === municipio);

  // Datos reales (tabla granular). Fallback a mock si está vacía.
  const real = await queryRealIncidencia({ municipio });
  if (real.length > 0) return real;
  return getMockIncidenciaTable().filter((r) => r.municipio === municipio);
}

/**
 * Get aggregated data for Estado de México
 */
export async function getIncidenciaEstatal(anio?: number, mes?: number) {
  const filterMock = (rows: IncidenciaDelictiva[]) =>
    rows.filter((r) => (anio ? r.anio === anio : true) && (mes ? r.mes === mes : true));

  const db = await getDb();
  // Modo degradado (sin BD): servir simulado para que la UI no quede vacía.
  if (!db) return filterMock(getMockIncidenciaTable());

  // Datos reales (tabla granular). Fallback a mock si está vacía.
  const real = await queryRealIncidencia({ anio, mes });
  if (real.length > 0) return real;
  return filterMock(getMockIncidenciaTable());
}
