// ============================================================
// MAPA GEOESPACIAL — PREDIX v2 (alineado al dashboard).
// Desktop: KPIs → barra de capas → mapa + panel lateral.
// Móvil: mapa protagonista; capas en botón flotante (popover) y
// listado en hoja inferior arrastrable. Tokens --px-*, mapa vía
// TacticalMap (Leaflet + CARTO, sin API key).
// ============================================================

import { useMemo, useState } from "react";
import { toast } from "sonner";
import TacticalMap, { type TacticalMunicipio, type TacticalAlerta } from "@/components/TacticalMap";
import ElementoDetailModal from "@/components/ElementoDetailModal";
import { POLICE_ELEMENTS, type PoliceElement } from "@/data/policeData";
import { useIncidenciaMapa } from "@/hooks/useIncidenciaData";
import { trpc } from "@/lib/trpc";
import {
  Layers, Thermometer, MapPin, Filter, RefreshCw, Shield, Radio, Navigation,
  FlaskConical, Search, AlertTriangle, Users, ChevronUp, X,
} from "lucide-react";

type MapLayer = "heatmap" | "markers" | "alertas" | "limites" | "policia";

const EDOMEX_CENTER = { lat: 19.4326, lng: -99.1332 };

function nivelColor(nivel: string) {
  return nivel === "crítico" ? "var(--px-crit)" : nivel === "alto" ? "var(--px-warn)" : nivel === "medio" ? "var(--px-brand)" : "var(--px-ok)";
}

// Tarjeta KPI (mismo lenguaje del dashboard).
function Kpi({ label, value, unit, icon, accent }: {
  label: string; value: string | number; unit?: string; icon: React.ReactNode; accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5" style={{
      background: "var(--px-surface)", border: "1px solid var(--px-hairline)",
      borderRadius: "var(--px-r-md)", padding: "7px 12px",
    }}>
      <span className="flex items-center justify-center shrink-0" style={{
        width: 26, height: 26, borderRadius: "var(--px-r-sm)",
        background: "var(--px-surface-2)", color: accent ?? "var(--px-text-faint)",
      }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{
          fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.14em",
          color: "var(--px-text-faint)", textTransform: "uppercase",
        }}>{label}</div>
        <div style={{ fontFamily: "var(--px-display)", fontWeight: 700, fontSize: "var(--px-text-lg)", color: "var(--px-text)", lineHeight: 1.1 }}>
          {value}
          {unit && <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", fontWeight: 500, color: "var(--px-text-faint)", marginLeft: 4 }}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export default function MapaTab() {
  const [activeLayers, setActiveLayers] = useState<Set<MapLayer>>(new Set<MapLayer>(["heatmap", "markers", "policia"]));
  const [selectedMunicipio, setSelectedMunicipio] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<PoliceElement | null>(null);
  const [sidePanel, setSidePanel] = useState<"municipios" | "elementos">("municipios");
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; key: number }>();
  const [coords, setCoords] = useState({ lat: EDOMEX_CENTER.lat, lng: EDOMEX_CENTER.lng, zoom: 10 });
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false); // popover capas (móvil)
  const [sheetOpen, setSheetOpen] = useState(false);    // hoja listado (móvil)
  const [detailEl, setDetailEl] = useState<PoliceElement | null>(null); // modal detalle

  // Incidencia REAL por municipio (último mes) — alimenta mapa, KPIs y panel.
  const { municipios: mapaData, origen } = useIncidenciaMapa();
  const esReal = origen === "real";
  const municipiosReal = useMemo<TacticalMunicipio[]>(
    () => mapaData.map((m) => ({
      nombre: m.municipio, cveMuni: m.codigoMunicipio, lat: m.lat, lng: m.lng,
      nivel: m.nivel, delitos: m.incidentes, tendencia: m.tendencia,
    })),
    [mapaData],
  );

  const openElement = (el: PoliceElement) => {
    setSelectedElement(el);
    setDetailEl(el);
  };
  const centrarElemento = (el: PoliceElement) => {
    setFocus({ lat: el.identification.lat, lng: el.identification.lng, zoom: 14, key: Date.now() });
    setSheetOpen(false);
  };

  const toggleLayer = (layer: MapLayer) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setFocus({ ...EDOMEX_CENTER, zoom: 10, key: Date.now() });
    toast.success("Vista actualizada", { description: "Mapa re-centrado en el Estado de México." });
    setTimeout(() => setRefreshing(false), 700);
  };

  const policeCount = POLICE_ELEMENTS.filter(e => e.role === "Policía" && e.status === "active").length;
  const commanderCount = POLICE_ELEMENTS.filter(e => e.role === "Comandante" && e.status === "active").length;
  const totalElementos = policeCount + commanderCount;
  // Alertas críticas reales — misma fuente que Header/SideNav (alertas.listar).
  const { data: alertasResp } = trpc.alertas.listar.useQuery();
  const alertasCriticasReal = useMemo(
    () => (alertasResp?.data ?? []).filter(a => a.nivel === "critical" && !a.resuelta),
    [alertasResp],
  );
  const alertasCriticas = alertasCriticasReal.length;
  // Solo las que ya tienen coordenada real (resolveAlertaCoords) — nunca una posición inventada.
  const alertasMapa = useMemo<TacticalAlerta[]>(
    () => alertasCriticasReal
      .filter((a): a is typeof a & { lat: string; lng: string } => !!a.lat && !!a.lng)
      .map(a => ({
        id: a.id, lat: parseFloat(a.lat), lng: parseFloat(a.lng),
        titulo: a.titulo, descripcion: a.descripcion || undefined, municipio: a.municipio,
        hora: new Date(a.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      })),
    [alertasCriticasReal],
  );
  const zonasCriticas = municipiosReal.filter(m => m.nivel === "crítico").length;

  const municipiosFiltrados = municipiosReal.filter(m =>
    m.nombre.toLowerCase().includes(search.trim().toLowerCase())
  );

  // ── Botones de capa (reusados: barra desktop + popover móvil) ──
  const LAYER_DEFS: { id: MapLayer; label: string; icon: React.ReactNode }[] = [
    { id: "heatmap", label: "Mapa de Calor", icon: <Thermometer size={11} /> },
    { id: "markers", label: "Municipios", icon: <MapPin size={11} /> },
    { id: "limites", label: "Límites Municipales", icon: <Navigation size={11} /> },
    { id: "alertas", label: "Alertas Activas", icon: <Filter size={11} /> },
    { id: "policia", label: `Elementos (${totalElementos}) · DEMO`, icon: <Shield size={11} /> },
  ];
  const layerButton = (layer: typeof LAYER_DEFS[number]) => {
    const on = activeLayers.has(layer.id);
    return (
      <button
        key={layer.id}
        onClick={() => toggleLayer(layer.id)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors shrink-0 whitespace-nowrap px-hit44"
        style={{
          fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.06em",
          background: on ? "var(--px-brand-soft)" : "transparent",
          border: `1px solid ${on ? "rgba(0,212,255,0.4)" : "var(--px-hairline)"}`,
          color: on ? "var(--px-brand)" : "var(--px-text-muted)", cursor: "pointer",
        }}
      >
        {layer.icon}
        {layer.label}
      </button>
    );
  };
  const refreshButton = (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors shrink-0 whitespace-nowrap px-hit44"
      style={{
        background: "var(--px-brand-soft)", border: "1px solid rgba(0,212,255,0.25)",
        color: "var(--px-brand)", fontSize: "var(--px-text-xs)", fontFamily: "var(--px-mono)",
        letterSpacing: "0.06em", cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.6 : 1,
      }}
    >
      <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
      ACTUALIZAR
    </button>
  );

  // ── Contenido del listado (reusado: panel desktop + hoja móvil) ──
  const panelInner = (
    <>
      {/* Segmentado municipios / elementos */}
      <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--px-hairline)" }}>
        {([
          { id: "municipios" as const, label: "MUNICIPIOS", icon: <MapPin size={11} /> },
          { id: "elementos" as const, label: `ELEMENTOS (${totalElementos}) · DEMO`, icon: <Shield size={11} /> },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setSidePanel(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors px-hit44"
            style={{
              fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.06em",
              background: sidePanel === t.id ? "var(--px-brand-soft)" : "transparent",
              borderBottom: sidePanel === t.id ? "2px solid var(--px-brand)" : "2px solid transparent",
              color: sidePanel === t.id ? "var(--px-brand)" : "var(--px-text-muted)", cursor: "pointer",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {sidePanel === "municipios" ? (
        <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
          <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--px-hairline)" }}>
            <div className="relative">
              <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--px-text-faint)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar municipio…"
                className="w-full"
                style={{
                  background: "var(--px-bg)", border: "1px solid var(--px-hairline-strong)",
                  borderRadius: "var(--px-r-sm)", padding: "8px 10px 8px 28px", minHeight: 44,
                  boxSizing: "border-box", color: "var(--px-text)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-base)",
                }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-tactical" style={{ minHeight: 0 }}>
            {municipiosFiltrados.length === 0 ? (
              <div className="px-3 py-6 text-center" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text-faint)" }}>
                Sin municipios para “{search}”.
              </div>
            ) : municipiosFiltrados.map(mun => {
              const color = nivelColor(mun.nivel);
              const tColor = mun.tendencia > 0 ? "var(--px-crit)" : "var(--px-ok)";
              return (
                <div
                  key={mun.nombre}
                  className="px-3 py-2.5 cursor-pointer transition-colors"
                  style={{
                    borderBottom: "1px solid var(--px-hairline)",
                    background: selectedMunicipio === mun.nombre ? "var(--px-brand-soft)" : "transparent",
                  }}
                  onClick={() => {
                    setSelectedMunicipio(mun.nombre);
                    setFocus({ lat: mun.lat, lng: mun.lng, zoom: 13, key: Date.now() });
                    setSheetOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", fontWeight: 500, color: "var(--px-text)" }}>{mun.nombre}</span>
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color, textTransform: "uppercase" }}>{mun.nivel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>{mun.delitos.toLocaleString()} delitos</span>
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: tColor }}>{mun.tendencia > 0 ? "▲" : "▼"} {Math.abs(mun.tendencia)}%</span>
                  </div>
                  <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 2, background: "var(--px-hairline-strong)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (mun.delitos / 5000) * 100)}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-tactical" style={{ minHeight: 0 }}>
          <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid var(--px-hairline)", background: "color-mix(in srgb, var(--px-warn) 8%, transparent)" }}>
            <AlertTriangle size={12} style={{ color: "var(--px-warn)", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-warn)" }}>
              Simulación de despliegue táctico — no rastrea personal real.
            </span>
          </div>
          {POLICE_ELEMENTS.filter(e => e.status === "active").map(element => {
            const isCommander = element.role === "Comandante";
            const color = isCommander ? "#AB47BC" : "#4FC3F7";
            const idIcon = element.identification.type === "patrulla" ? <Navigation size={10} /> :
                           element.identification.type === "grupo_operativo" ? <Shield size={10} /> :
                           element.identification.type === "gps" ? <Radio size={10} /> : <Radio size={10} />;
            const isSelected = selectedElement?.id === element.id;
            return (
              <div
                key={element.id}
                className="px-3 py-2.5 cursor-pointer transition-colors"
                style={{
                  borderBottom: "1px solid var(--px-hairline)",
                  background: isSelected ? "var(--px-brand-soft)" : "transparent",
                  borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                }}
                onClick={() => openElement(element)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}25`, border: `1px solid ${color}50`, color }}>
                    {isCommander ? <Shield size={10} /> : <Navigation size={10} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", fontWeight: 500, color: "var(--px-text)" }}>{element.name}</span>
                    <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color }}>{element.role.toUpperCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-7">
                  <span className="flex items-center gap-1" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
                    {idIcon}
                    {element.identification.value}
                  </span>
                </div>
                <div className="flex items-center justify-between ml-7 mt-1">
                  <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{element.department}</span>
                  <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-ok)" }}>● EN LÍNEA</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full relative" style={{ background: "var(--px-bg)", padding: "var(--px-3)", gap: "var(--px-3)" }}>
      {/* ── KPIs (1 fila scroll en móvil) + badge ── */}
      <div className="px-card flex items-center gap-3" style={{ padding: "var(--px-2) var(--px-4)", flexShrink: 0 }}>
        {/* Un solo modo grid con minmax(170px,1fr) en vez de flex-móvil +
            grid-cols-4-desktop con breakpoint fijo — probado con un
            breakpoint (md, luego xl) y en ambos casos, en algún ancho
            intermedio, la columna se quedaba más angosta que el label más
            largo ("Elementos en línea", 130px) y lo truncaba o colapsaba a
            0px (verificado midiendo clientWidth real, no a ojo). Con
            minmax(170px,1fr) cada columna nunca baja de 170px — si no caben
            las 4, la fila desborda y usa el mismo overflow-x-auto/scroll que
            ya existía para móvil, sin importar el ancho exacto. */}
        <div className="grid gap-2 flex-1 overflow-x-auto scrollbar-tactical" style={{ gridTemplateColumns: "repeat(4, minmax(195px, 1fr))" }}>
          <Kpi label="Monitoreados" value={municipiosReal.length} unit="/ 125" icon={<MapPin size={11} />} accent="var(--px-brand)" />
          <Kpi label="Alertas críticas" value={alertasCriticas} icon={<AlertTriangle size={11} />} accent="var(--px-crit)" />
          <Kpi label="Elementos en línea" value={totalElementos} unit="DEMO" icon={<Users size={11} />} accent="var(--px-ok)" />
          <Kpi label="Zonas críticas" value={zonasCriticas} icon={<Shield size={11} />} accent="var(--px-warn)" />
        </div>
        {/* Antes "hidden sm:flex" — el badge de honestidad (real vs. simulado)
            desaparecía por completo en móvil, justo el principio que más se
            cuida en todo el resto del producto. En <640px se
            reduce a "REAL"/"SIM" (mismo patrón compacto que ya usa el badge
            de Frescura del Dato en el Tablero) en vez de ocultarse. */}
        {/* Antes "INCIDENCIA REAL · SESNSP" con letter-spacing 0.1em — el
            pill terminaba casi tan ancho como una tarjeta KPI completa
            (~190px) para comunicar mucho menos, y al no encogerse (shrink-0)
            en la fila flex-1 le quitaba espacio real al área de KPIs.
            "REAL · SESNSP" dice lo mismo (la palabra "incidencia" ya la da
            el contexto del tab) con menos tracking — más chico sin perder
            significado. */}
        <div className="flex items-center gap-1.5 self-start shrink-0" title={esReal ? "Incidencia real · SESNSP" : "Datos simulados"} style={{
          fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.06em",
          color: esReal ? "var(--px-ok)" : "var(--px-warn)",
          background: esReal ? "rgba(63,185,80,0.1)" : "rgba(229,162,61,0.1)",
          border: `1px solid ${esReal ? "rgba(63,185,80,0.3)" : "rgba(229,162,61,0.3)"}`,
          borderRadius: "999px", padding: "3px 8px",
        }}>
          <FlaskConical size={10} />
          <span className="sm:hidden">{esReal ? "REAL" : "SIM"}</span>
          <span className="hidden sm:inline">{esReal ? "REAL · SESNSP" : "SIMULADO"}</span>
        </div>
      </div>

      {/* ── Barra de capas (solo desktop) ── */}
      <div className="hidden md:flex items-center gap-2.5 px-card" style={{
        padding: "var(--px-2) var(--px-4)", flexShrink: 0,
      }}>
        <div className="flex items-center gap-2 shrink-0">
          <Layers size={13} style={{ color: "var(--px-text-faint)" }} />
          <span style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)", letterSpacing: "0.08em" }}>CAPAS:</span>
        </div>
        {LAYER_DEFS.map(layerButton)}
        <div className="ml-auto">{refreshButton}</div>
      </div>

      {/* ── Cuerpo: mapa + panel lateral (desktop) ── */}
      <div className="flex flex-col md:flex-row flex-1 gap-3" style={{ minHeight: 0 }}>
        <div className="px-card relative flex-1 min-h-75 md:min-h-0 overflow-hidden">
          <div className="w-full h-full">
            <TacticalMap
              className="w-full h-full"
              center={[EDOMEX_CENTER.lat, EDOMEX_CENTER.lng]}
              zoom={10}
              municipios={municipiosReal}
              alertas={alertasMapa}
              layers={{
                heatmap: activeLayers.has("heatmap"),
                municipios: activeLayers.has("markers"),
                alertas: activeLayers.has("alertas"),
                limites: activeLayers.has("limites"),
                policia: activeLayers.has("policia"),
              }}
              focus={focus}
              onViewChange={setCoords}
              onSelectMunicipio={setSelectedMunicipio}
              onSelectElement={openElement}
            />
          </div>

          {/* Leyenda (desktop) */}
          <div className="absolute bottom-4 left-4 px-3 py-2 rounded hidden md:block" style={{
            background: "rgba(10,22,40,0.9)", border: "1px solid var(--px-hairline-strong)",
            backdropFilter: "blur(8px)", zIndex: 500,
          }}>
            <div style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)", letterSpacing: "0.1em", marginBottom: 8 }}>NIVEL DE RIESGO</div>
            {[
              { color: "var(--px-crit)", label: "Crítico" },
              { color: "var(--px-warn)", label: "Alto" },
              { color: "var(--px-brand)", label: "Medio" },
              { color: "var(--px-ok)", label: "Bajo" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Coords vivas (desktop) */}
          <div className="absolute top-3 right-3 px-3 py-2 rounded hidden md:block" style={{
            background: "rgba(10,22,40,0.85)", border: "1px solid var(--px-hairline)", zIndex: 500,
          }}>
            <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>CENTRO · z{coords.zoom}</div>
            <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-brand)" }}>
              {coords.lat.toFixed(4)}° N, {Math.abs(coords.lng).toFixed(4)}° W
            </div>
          </div>

          {/* ── Botón flotante CAPAS (solo móvil) ── */}
          <button
            className="md:hidden absolute top-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-lg px-hit44"
            style={{ background: "rgba(10,22,40,0.92)", border: "1px solid var(--px-hairline-strong)", color: "var(--px-brand)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", zIndex: 600 }}
            onClick={() => setLayersOpen(v => !v)}
            aria-expanded={layersOpen}
          >
            <Layers size={14} /> Capas
          </button>
          {layersOpen && (
            <div
              className="md:hidden absolute inset-0"
              style={{ zIndex: 590 }}
              onClick={() => setLayersOpen(false)}
              aria-hidden
            />
          )}
          {layersOpen && (
            <div className="md:hidden absolute top-14 right-3 p-2.5 rounded-lg flex flex-col gap-2" style={{
              background: "var(--px-surface-2)", border: "1px solid var(--px-hairline-strong)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.55)", zIndex: 600, width: 210,
            }}>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.18em", color: "var(--px-text-faint)", textTransform: "uppercase" }}>// Capas</span>
                <button onClick={() => setLayersOpen(false)} aria-label="Cerrar" style={{ color: "var(--px-text-faint)" }}><X size={14} /></button>
              </div>
              <div className="flex flex-col gap-1.5 [&>button]:w-full [&>button]:justify-start">
                {LAYER_DEFS.map(layerButton)}
              </div>
              <div className="[&>button]:w-full">{refreshButton}</div>
            </div>
          )}
        </div>

        {/* Panel lateral (solo desktop) */}
        <div
          className="hidden md:flex md:w-72 lg:w-80 shrink-0 overflow-hidden flex-col px-card"
          style={{ minHeight: 0 }}
        >
          {panelInner}
        </div>
      </div>

      {/* ── Hoja inferior de listado (solo móvil) ── */}
      {sheetOpen && (
        <div
          className="md:hidden absolute inset-0"
          style={{ zIndex: 590 }}
          onClick={() => setSheetOpen(false)}
          aria-hidden
        />
      )}
      <div
        className="md:hidden absolute left-0 right-0 bottom-0 flex flex-col"
        style={{
          background: "var(--px-surface)", borderTop: "1px solid var(--px-hairline-strong)",
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          boxShadow: "0 -12px 30px rgba(0,0,0,0.5)", zIndex: 600,
          height: sheetOpen ? "70%" : "auto", maxHeight: "70%",
          transition: "height 0.25s ease",
        }}
      >
        <button onClick={() => setSheetOpen(v => !v)} className="shrink-0 px-4 pt-2 pb-2.5" aria-expanded={sheetOpen}>
          <div className="mx-auto mb-2 rounded-full" style={{ width: 38, height: 4, background: "var(--px-hairline-strong)" }} aria-hidden />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.08em", color: "var(--px-text-muted)" }}>
              <MapPin size={12} style={{ color: "var(--px-brand)" }} />
              Listado · {sidePanel === "municipios" ? `${municipiosReal.length} municipios` : `${totalElementos} elementos`}
            </span>
            <ChevronUp size={16} style={{ color: "var(--px-text-faint)", transform: sheetOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </div>
        </button>
        {sheetOpen && <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0, borderTop: "1px solid var(--px-hairline)" }}>{panelInner}</div>}
      </div>

      {/* Modal de detalle de elemento */}
      <ElementoDetailModal element={detailEl} onClose={() => setDetailEl(null)} onCentrar={centrarElemento} />
    </div>
  );
}
