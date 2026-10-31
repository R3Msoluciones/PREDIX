/**
 * load-sesnsp.ts — Carga los CSV normalizados a MySQL via LOAD DATA LOCAL INFILE.
 *
 * Prerequisitos:
 *   1. MySQL/TiDB corriendo y DATABASE_URL en .env (o env var).
 *   2. Tablas creadas: `pnpm db:push` (crea incidencia_delito + incidencia_victima).
 *   3. Servidor MySQL con local_infile=ON (Docker: --local-infile=1).
 *
 * Uso:
 *   pnpm tsx scripts/load-sesnsp.ts
 *   (o: npx tsx scripts/load-sesnsp.ts)
 *
 * Idempotente: hace TRUNCATE antes de cargar, se puede re-correr.
 */

import { createConnection } from "mysql2/promise";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const NORM = resolve(ROOT, "data/sesnsp/_normalized");

// ── Resolver DATABASE_URL (env o .env) ──
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = resolve(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL=(.*)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

// LOAD DATA en MySQL no acepta placeholder para el path; se inyecta inline.
// Forward slashes para evitar problemas de escape en Windows.
function infilePath(p: string): string {
  return resolve(NORM, p).replace(/\\/g, "/");
}

async function main() {
  const url = getDatabaseUrl();
  if (!url) {
    console.error("[load] DATABASE_URL vacío. Configúralo en .env antes de cargar.");
    process.exit(1);
  }

  const delitosCsv = infilePath("delitos_long.csv");
  const victimasCsv = infilePath("victimas_long.csv");
  for (const f of [delitosCsv, victimasCsv]) {
    if (!existsSync(f)) {
      console.error(`[load] No existe ${f}. Corre antes scripts/transform-edomex.ps1`);
      process.exit(1);
    }
  }

  // infileStreamFactory habilita LOAD DATA LOCAL INFILE en mysql2.
  const conn = await createConnection({
    uri: url,
    infileStreamFactory: (path: string) => createReadStream(path),
    multipleStatements: false,
  });

  try {
    // ── DELITOS ──
    console.log("[load] Truncando + cargando incidencia_delito...");
    await conn.query("TRUNCATE TABLE incidencia_delito");
    const [delRes] = await conn.query(
      `LOAD DATA LOCAL INFILE '${delitosCsv}'
       INTO TABLE incidencia_delito
       FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
       LINES TERMINATED BY '\\r\\n'
       IGNORE 1 LINES
       (anio, mes, cve_ent, entidad, cve_muni, municipio,
        bien_juridico, tipo, subtipo, modalidad, fuero, cantidad)`,
    );
    console.log("[load] incidencia_delito:", (delRes as { affectedRows: number }).affectedRows, "filas");

    // ── VICTIMAS ──
    console.log("[load] Truncando + cargando incidencia_victima...");
    await conn.query("TRUNCATE TABLE incidencia_victima");
    const [vicRes] = await conn.query(
      `LOAD DATA LOCAL INFILE '${victimasCsv}'
       INTO TABLE incidencia_victima
       FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
       LINES TERMINATED BY '\\r\\n'
       IGNORE 1 LINES
       (anio, mes, cve_ent, entidad, cve_muni, municipio,
        bien_juridico, tipo, subtipo, modalidad, sexo, rango_edad, fuero, cantidad)`,
    );
    console.log("[load] incidencia_victima:", (vicRes as { affectedRows: number }).affectedRows, "filas");

    // ── Verificación rápida ──
    const [[delCount]] = await conn.query("SELECT COUNT(*) AS n, COUNT(DISTINCT cve_muni) AS munis, COUNT(DISTINCT tipo) AS tipos FROM incidencia_delito") as unknown as [[{ n: number; munis: number; tipos: number }]];
    console.log(`[load] OK → delitos: ${delCount.n} filas, ${delCount.munis} municipios, ${delCount.tipos} tipos`);
  } catch (err) {
    console.error("[load] ERROR:", err instanceof Error ? err.message : err);
    console.error("[load] Si dice 'LOAD DATA LOCAL INFILE is disabled', arranca MySQL con --local-infile=1.");
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
