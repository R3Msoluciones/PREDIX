// ============================================================
// TACTICAL MAP — Mapa Leaflet + tiles CARTO dark (SIN API key).
// Reemplaza Google Maps en MapaTab/ZonasTab para que el mapa se vea
// sin depender de VITE_FRONTEND_FORGE_API_KEY. Capas controladas por
// props; marcadores/heat/círculos construidos desde los datos mock.
// ============================================================

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { cn } from "@/lib/utils";
import { POLICE_ELEMENTS, type PoliceElement } from "@/data/policeData";

export interface TacticalMapLayers {
  heatmap?: boolean;
  municipios?: boolean;
  alertas?: boolean;
  policia?: boolean;
  limites?: boolean;
  /** Círculos de cobertura por municipio (vista Zonas). */
  zonaCircles?: boolean;
}

/** Municipio georreferenciado para las capas de incidencia (datos reales). */
export interface TacticalMunicipio {
  nombre: string;
  /** Clave INEGI (cve_ent+cve_mun) — llave para amarrar con el polígono real del municipio. */
  cveMuni?: string;
  lat: number;
  lng: number;
  nivel: string;
  delitos: number;
  tendencia: number;
}

/** Alerta real georreferenciada (alertas.listar) para la capa "Alertas Activas". */
export interface TacticalAlerta {
  id: number;
  lat: number;
  lng: number;
  titulo: string;
  descripcion?: string;
  municipio: string;
  hora: string;
}

interface MunicipioGeoJsonProperties {
  cveMuni: string;
  nombre: string;
}

// Cache a nivel de módulo: el archivo (~360KB) no cambia entre renders ni
// entre montajes del mapa (Mapa/Zonas comparten el mismo TacticalMap), así
// que se descarga una sola vez por sesión de la pestaña.
let municipiosGeoJsonPromise: Promise<GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon, MunicipioGeoJsonProperties> | null> | null = null;
function getMunicipiosGeoJson() {
  if (!municipiosGeoJsonPromise) {
    municipiosGeoJsonPromise = fetch("/data/edomex-municipios.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return municipiosGeoJsonPromise;
}

interface TacticalMapProps {
  className?: string;
  center: [number, number];
  zoom: number;
  layers?: TacticalMapLayers;
  /** Municipios reales a pintar (heatmap/marcadores/círculos). */
  municipios?: TacticalMunicipio[];
  /** Alertas críticas reales a pintar (capa "Alertas Activas"). */
  alertas?: TacticalAlerta[];
  /** Recentra el mapa al cambiar `key` (click en panel lateral). */
  focus?: { lat: number; lng: number; zoom?: number; key: number };
  /** Reporta centro/zoom al terminar un movimiento (coords vivas). */
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  onSelectMunicipio?: (nombre: string) => void;
  onSelectElement?: (el: PoliceElement) => void;
}

const nivelColor = (nivel: string) =>
  nivel === "crítico" ? "#FF3B3B" : nivel === "alto" ? "#FFB800" : nivel === "medio" ? "#00D4FF" : "#00E676";

// Leaflet's bindPopup/bindTooltip parsean el string como HTML — cualquier
// valor que venga de datos reales (alertas.titulo/descripcion son texto libre
// del formulario "Crear alerta", editable por cualquier usuario con permiso)
// debe escaparse antes de interpolarse, o un <script>/onerror= quedaría
// almacenado y se ejecutaría para cualquiera que abra ese popup en el mapa.
export const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Hover: resalta el marcador (más grueso/opaco) y vuelve al salir.
function withHover(m: L.CircleMarker, base: L.PathOptions) {
  m.on("mouseover", () => m.setStyle({ weight: (base.weight ?? 1) + 1.5, fillOpacity: 1 }));
  m.on("mouseout", () => m.setStyle(base));
  return m;
}

export default function TacticalMap({
  className,
  center,
  zoom,
  layers = { heatmap: true, municipios: true, policia: true },
  municipios = [],
  alertas = [],
  focus,
  onViewChange,
  onSelectMunicipio,
  onSelectElement,
}: TacticalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const groups = useRef<Record<keyof TacticalMapLayers, L.LayerGroup>>({
    heatmap: L.layerGroup(),
    municipios: L.layerGroup(),
    alertas: L.layerGroup(),
    policia: L.layerGroup(),
    limites: L.layerGroup(),
    zonaCircles: L.layerGroup(),
  });
  // Callbacks en ref para no recrear el mapa cuando cambian.
  const cbMun = useRef(onSelectMunicipio);
  const cbEl = useRef(onSelectElement);
  const cbView = useRef(onViewChange);
  cbMun.current = onSelectMunicipio;
  cbEl.current = onSelectElement;
  cbView.current = onViewChange;

  // ── Init mapa (una vez) ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });
    mapRef.current = map;

    // CARTO exige API key (pinta marca de agua) y Esri Dark Gray casi no trae calles ni
    // nombres. OSM estándar con filtro CSS de inversión da mapa oscuro con todo el detalle.
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    tiles.getContainer().style.filter = "invert(1) hue-rotate(200deg) brightness(0.95) contrast(0.95) saturate(0.6)";
    tiles.on("load", () => { setLoading(false); setOffline(false); });
    tiles.on("tileerror", () => { setLoading(false); setOffline(true); });
    // Salvaguarda: si en 6s no cargaron tiles, quita el skeleton igual.
    const loadTimer = setTimeout(() => setLoading(false), 6000);

    const g = groups.current;

    // Las capas de incidencia (heatmap/marcadores/círculos), alertas y elementos
    // se construyen desde props (datos reales / demo etiquetado) en efectos
    // aparte, para que se re-pinten cuando llegan/cambian los datos.

    // Elementos en campo — DEMO: sin tabla real de rastreo de personal/flota
    //; marcado explícitamente en tooltip/popup para que nadie
    // lo confunda con un despliegue real solo por pasar el mouse en el mapa.
    POLICE_ELEMENTS.filter((e) => e.status === "active").forEach((el) => {
      const isCmd = el.role === "Comandante";
      const color = isCmd ? "#AB47BC" : "#4FC3F7";
      const base: L.PathOptions = { color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 0.9 };
      withHover(
        L.circleMarker([el.identification.lat, el.identification.lng], { radius: isCmd ? 9 : 6, ...base })
          .bindTooltip(`${escHtml(el.name)} · ${escHtml(el.identification.value)} · DEMO`, { direction: "top", className: "tac-tip" })
          .bindPopup(
            `<div class="tac-pop"><div class="tac-pop-eyebrow" style="color:${color}">${escHtml(el.role.toUpperCase())} · DEMO</div>
             <div class="tac-pop-title">${escHtml(el.name)}</div>
             <div class="tac-pop-row"><span>Identificación</span><b style="color:${color}">${escHtml(el.identification.value)}</b></div>
             <div class="tac-pop-row"><span>Tipo rastreo</span><b>${escHtml(el.identification.type.replace("_", " ").toUpperCase())}</b></div>
             <div class="tac-pop-row"><span>Departamento</span><b>${escHtml(el.department)}</b></div>
             <div class="tac-pop-meta">${el.identification.lat.toFixed(4)}° N, ${Math.abs(el.identification.lng).toFixed(4)}° W</div></div>`
          )
          .on("click", () => cbEl.current?.(el)),
        base,
      ).addTo(g.policia);
    });

    // Coords vivas: reporta al terminar cada movimiento (barato vs "move").
    const emitView = () => {
      const c = map.getCenter();
      cbView.current?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };
    map.on("moveend", emitView);
    emitView();

    // Recalcula tamaño tras montar y cuando el contenedor cambia de tamaño.
    setTimeout(() => map.invalidateSize(), 0);
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) map.invalidateSize();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      clearTimeout(loadTimer);
      map.remove();
      mapRef.current = null;
      // Reinicia grupos para un posible remonte limpio.
      (Object.keys(groups.current) as (keyof TacticalMapLayers)[]).forEach((k) => {
        groups.current[k] = L.layerGroup();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle de capas según props ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const g = groups.current;
    const want: Record<keyof TacticalMapLayers, boolean> = {
      heatmap: !!layers.heatmap,
      municipios: !!layers.municipios,
      alertas: !!layers.alertas,
      policia: !!layers.policia,
      limites: !!layers.limites,
      zonaCircles: !!layers.zonaCircles,
    };
    (Object.keys(want) as (keyof TacticalMapLayers)[]).forEach((k) => {
      const has = map.hasLayer(g[k]);
      if (want[k] && !has) g[k].addTo(map);
      else if (!want[k] && has) map.removeLayer(g[k]);
    });
  }, [layers.heatmap, layers.municipios, layers.alertas, layers.policia, layers.limites, layers.zonaCircles]);

  // ── Carga límites municipales reales (INEGI, Marco Geoestadístico) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const g = groups.current;
    let cancelled = false;

    getMunicipiosGeoJson().then((geojson) => {
      if (cancelled) return;
      g.limites.clearLayers();
      if (!geojson) return; // sin conexión al asset — capa queda vacía, no rompe el mapa

      const nivelPorCve = new Map(municipios.filter((m) => m.cveMuni).map((m) => [m.cveMuni, m.nivel]));
      L.geoJSON(geojson, {
        style: (feature) => {
          const nivel = feature?.properties?.cveMuni ? nivelPorCve.get(feature.properties.cveMuni) : undefined;
          return {
            color: nivel ? nivelColor(nivel) : "#00D4FF",
            weight: 1.5,
            opacity: 0.6,
            fillOpacity: 0.03,
            fillColor: nivel ? nivelColor(nivel) : "#00D4FF",
          };
        },
        onEachFeature: (feature, layer) => {
          const nombre = feature.properties?.nombre;
          if (nombre) layer.bindTooltip(escHtml(nombre), { sticky: true, className: "tac-tip" });
        },
      }).addTo(g.limites);
    });

    return () => { cancelled = true; };
  }, [municipios]);

  // ── (Re)construye la capa de alertas críticas reales (prop `alertas`) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const g = groups.current;
    g.alertas.clearLayers();

    alertas.forEach((al) => {
      const icon = L.divIcon({
        className: "tac-alert-icon",
        html: `<span class="tac-ping"></span><span class="tac-ping-core"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([al.lat, al.lng], { icon })
        .bindPopup(
          `<div class="tac-pop tac-pop-crit"><div class="tac-pop-eyebrow">⚠ ALERTA CRÍTICA — ALT-${String(al.id).padStart(3, "0")}</div>
           <div class="tac-pop-title" style="color:#FF6B6B">${escHtml(al.titulo)}</div>
           <div class="tac-pop-desc">${escHtml(al.descripcion || "")}</div>
           <div class="tac-pop-meta">${escHtml(al.municipio)} · ${escHtml(al.hora)}</div></div>`
        )
        .addTo(g.alertas);
    });
  }, [alertas]);

  // ── (Re)construye capas de incidencia desde datos reales (`municipios`) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const g = groups.current;
    g.heatmap.clearLayers();
    g.municipios.clearLayers();
    g.zonaCircles.clearLayers();
    if (municipios.length === 0) return;
    const container = mapRef.current?.getContainer();
    if (container && (container.clientWidth === 0 || container.clientHeight === 0)) return;

    // Heatmap (leaflet.heat): municipios como puntos ponderados por incidencia.
    const heatPoints: [number, number, number][] = municipios.map(
      (m) => [m.lat, m.lng, Math.min(1, m.delitos / 3000)] as [number, number, number],
    );
    try {
      const heat = (L as any).heatLayer(heatPoints, {
        radius: 38, blur: 28, max: 1, minOpacity: 0.25,
        gradient: { 0.2: "#0064FF", 0.4: "#00D4FF", 0.6: "#FFB800", 0.8: "#FF6400", 1.0: "#FF3B3B" },
      });
      if (heat) heat.addTo(g.heatmap);
    } catch (e) {
      console.warn("Heatmap renderering failed:", e);
    }

    // Marcadores por municipio.
    municipios.forEach((mun) => {
      const color = nivelColor(mun.nivel);
      const r = mun.nivel === "crítico" ? 11 : mun.nivel === "alto" ? 8 : 6;
      const tIcon = mun.tendencia > 0 ? "▲" : "▼";
      const tColor = mun.tendencia > 0 ? "#FF3B3B" : "#00E676";
      const base: L.PathOptions = { color: "#ffffff", weight: 1.5, fillColor: color, fillOpacity: 0.85 };
      withHover(
        L.circleMarker([mun.lat, mun.lng], { radius: r, ...base })
          .bindTooltip(escHtml(mun.nombre), { direction: "top", className: "tac-tip" })
          .bindPopup(
            `<div class="tac-pop"><div class="tac-pop-title" style="color:${color}">${escHtml(mun.nombre)}</div>
             <div class="tac-pop-row"><span>Nivel de riesgo</span><b style="color:${color};text-transform:uppercase">${escHtml(mun.nivel)}</b></div>
             <div class="tac-pop-row"><span>Incidentes (mes)</span><b>${mun.delitos.toLocaleString()}</b></div>
             <div class="tac-pop-row"><span>Tendencia mensual</span><b style="color:${tColor}">${tIcon} ${Math.abs(mun.tendencia)}%</b></div></div>`
          )
          .on("click", () => cbMun.current?.(mun.nombre)),
        base,
      ).addTo(g.municipios);
    });

    // Círculos de cobertura por municipio (vista Zonas).
    municipios.forEach((mun) => {
      const color = nivelColor(mun.nivel);
      L.circle([mun.lat, mun.lng], {
        radius: mun.delitos * 3, color, weight: 1, opacity: 0.4, fillColor: color, fillOpacity: 0.08,
      }).addTo(g.zonaCircles);
    });
  }, [municipios]);

  // ── Recentrado imperativo (panel lateral) ──
  useEffect(() => {
    if (!mapRef.current || !focus) return;
    if (!isFinite(focus.lat) || !isFinite(focus.lng)) return;
    const container = mapRef.current.getContainer();
    if (container.clientWidth === 0 || container.clientHeight === 0) return;
    mapRef.current.flyTo([focus.lat, focus.lng], focus.zoom ?? mapRef.current.getZoom(), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  return (
    <div className={cn("relative w-full h-full", className)} style={{ minHeight: 220 }}>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: 220, background: "var(--px-bg)" }} />

      {/* Skeleton mientras cargan los tiles */}
      {loading && (
        <div className="tac-overlay" aria-hidden>
          <div className="tac-skeleton-grid" />
          <div className="tac-overlay-label">Cargando mapa…</div>
        </div>
      )}

      {/* Estado sin conexión a tiles */}
      {offline && !loading && (
        <div className="tac-overlay tac-overlay-offline" role="status">
          <div className="tac-overlay-label">Sin conexión al servicio de mapas. Reintenta o revisa tu red.</div>
        </div>
      )}
    </div>
  );
}
