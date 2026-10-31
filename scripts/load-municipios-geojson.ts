/**
 * load-municipios-geojson.ts — Descarga los polígonos municipales reales del
 * Estado de México desde el WFS público de INEGI (GeoServer, Marco
 * Geoestadístico) y los guarda como asset estático para el mapa.
 *
 * Fuente: mapas.inegi.org.mx/geoserver (WFS 2.0.0, capa
 * geografia:pi_mgn_areas_geoestadisticas_municipales), sin token — servicio
 * público. Reemplaza los cuadrados aproximados que dibuja hoy TacticalMap.tsx
 *.
 *
 * Uso: pnpm exec tsx scripts/load-municipios-geojson.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import simplify from "@turf/simplify";
import { EDOMEX_CENTROIDES } from "../server/data/edomexCentroids";

// Tolerancia en grados (no metros, @turf/simplify trabaja en las mismas
// unidades que las coordenadas) — ~0.0005° equivale a ~55m en esta latitud,
// imperceptible en un mapa Leaflet a escala de municipio/estado, pero reduce
// drásticamente el número de puntos (polígonos de INEGI vienen a detalle de
// levantamiento catastral, muy por encima de lo que un mapa web necesita).
const SIMPLIFY_TOLERANCE = 0.0005;

const __dirname = dirname(fileURLToPath(import.meta.url));

const WFS_URL =
  "https://mapas.inegi.org.mx/geoserver/ows?service=wfs&version=2.0.0&request=GetFeature" +
  "&typeName=geografia:pi_mgn_areas_geoestadisticas_municipales" +
  "&outputFormat=application/json&cql_filter=cve_ent=%2715%27";

const OUTPUT_PATH = resolve(__dirname, "../client/public/data/edomex-municipios.geojson");

interface InegiFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { cvegeo: string; nomgeo: string };
}

interface InegiFeatureCollection {
  type: "FeatureCollection";
  features: InegiFeature[];
}

async function main() {
  console.log("[municipios-geojson] Consultando WFS de INEGI (Marco Geoestadístico)...");
  // Timeout + reintentos: un WFS lento no debe colgar el build de despliegue.
  let data: InegiFeatureCollection | undefined;
  for (let intento = 1; intento <= 3 && !data; intento++) {
    try {
      const res = await fetch(WFS_URL, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`WFS de INEGI respondió ${res.status}`);
      data = (await res.json()) as InegiFeatureCollection;
    } catch (err) {
      console.warn(`[municipios-geojson] Intento ${intento}/3 falló:`, err);
      if (intento === 3) throw err;
    }
  }
  if (!data) throw new Error("No se obtuvo respuesta del WFS de INEGI");

  if (data.features.length !== 125) {
    throw new Error(`Se esperaban 125 municipios, llegaron ${data.features.length} — revisa el filtro cve_ent=15`);
  }

  const cveMunisEsperados = new Set(EDOMEX_CENTROIDES.map((m) => m.cveMuni));
  const cveMunisRecibidos = new Set(data.features.map((f) => f.properties.cvegeo));
  const faltantes = [...cveMunisEsperados].filter((c) => !cveMunisRecibidos.has(c));
  const sobrantes = [...cveMunisRecibidos].filter((c) => !cveMunisEsperados.has(c));
  if (faltantes.length > 0 || sobrantes.length > 0) {
    throw new Error(
      `Desajuste de claves entre INEGI y edomexCentroids.ts — faltantes: [${faltantes.join(",")}], sobrantes: [${sobrantes.join(",")}]`,
    );
  }

  const limpio: InegiFeatureCollection = {
    type: "FeatureCollection",
    features: data.features.map((f) => ({
      type: "Feature",
      geometry: f.geometry as InegiFeature["geometry"],
      properties: { cveMuni: f.properties.cvegeo, nombre: f.properties.nomgeo },
    })) as unknown as InegiFeature[],
  };

  const pesoAntes = Buffer.byteLength(JSON.stringify(limpio));
  console.log(`[municipios-geojson] Simplificando geometría (tolerancia ${SIMPLIFY_TOLERANCE}°)...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @turf/simplify acepta FeatureCollection genérico
  const simplificado = simplify(limpio as any, { tolerance: SIMPLIFY_TOLERANCE, highQuality: true });
  const pesoDespues = Buffer.byteLength(JSON.stringify(simplificado));
  console.log(
    `[municipios-geojson] ${(pesoAntes / 1024 / 1024).toFixed(2)} MB -> ${(pesoDespues / 1024 / 1024).toFixed(2)} MB ` +
      `(-${(100 - (pesoDespues / pesoAntes) * 100).toFixed(0)}%)`,
  );

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(simplificado));

  console.log(`[municipios-geojson] 125/125 municipios verificados, guardado en ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("[municipios-geojson] Error:", error);
  process.exit(1);
});
