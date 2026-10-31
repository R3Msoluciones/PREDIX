// ============================================================
// INCIDENTES — Registro y seguimiento (PREDIX v2)
// Senior layout: toolbar unificado → tabla master + detalle
// Mobile: card list → tap → detalle full-screen
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { INCIDENTES_RECIENTES, DATOS_MENSUALES } from "@/data/securityData";
import { Filter, Clock, MapPin, FileText, TrendingUp, ChevronDown, ArrowLeft, Plus, Trash2, CheckCircle, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { AdvancedIncidentFilter, type IncidentFilterState } from "@/components/AdvancedIncidentFilter";
import { useIncidentSearch } from "@/hooks/useIncidentSearch";
import IncidentDetailModal from "@/components/IncidentDetailModal";
import { OriginBadge, EmptyState } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

const ESTADO_DB_TO_LABEL: Record<string, string> = { en_proceso: "En proceso", cerrado: "Cerrado", investigacion: "Investigación" };
const ESTADO_LABEL_TO_DB: Record<string, "en_proceso" | "cerrado" | "investigacion"> = { "En proceso": "en_proceso", "Cerrado": "cerrado", "Investigación": "investigacion" };
const PRIORIDAD_DB_TO_LABEL: Record<string, string> = { baja: "baja", media: "media", alta: "alta", critica: "crítica" };
const PRIORIDAD_LABEL_TO_DB: Record<string, "baja" | "media" | "alta" | "critica"> = { baja: "baja", media: "media", alta: "alta", "crítica": "critica" };

interface IncidenteUI {
  id: string;
  tipo: string;
  municipio: string;
  colonia: string;
  hora: string;
  fecha: string;
  estado: string;
  prioridad: string;
  lat: number;
  lng: number;
  narrativa: string;
  personal: string;
  atendido: boolean;
  /** Presente solo en filas reales de BD; ausente en datos mock — usar `!== undefined`, nunca truthy check (id real puede ser 0). */
  _dbId?: number;
}

const priCfg = (p: string) => ({
  "crítica": { color: "var(--px-crit)", bg: "color-mix(in srgb, var(--px-crit) 10%, transparent)" },
  "alta": { color: "var(--px-warn)", bg: "color-mix(in srgb, var(--px-warn) 10%, transparent)" },
  "media": { color: "var(--px-brand)", bg: "color-mix(in srgb, var(--px-brand) 10%, transparent)" },
  "baja": { color: "var(--px-ok)", bg: "color-mix(in srgb, var(--px-ok) 10%, transparent)" },
}[p] ?? { color: "var(--px-text-muted)", bg: "color-mix(in srgb, var(--px-text-muted) 10%, transparent)" });

const estCfg = (e: string) => ({
  "En proceso": { color: "var(--px-warn)", label: "EN PROCESO" },
  "Cerrado": { color: "var(--px-ok)", label: "CERRADO" },
  "Investigación": { color: "var(--px-brand)", label: "INVESTIGACIÓN" },
}[e] ?? { color: "var(--px-text-muted)", label: e.toUpperCase() });

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)", borderRadius: "var(--px-r-sm)", padding: "6px 10px" }}>
      <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-brand)", marginBottom: 2 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

export default function IncidentesTab() {
  const [chartView, setChartView] = useState<"bar" | "line">("bar");
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editIncidente, setEditIncidente] = useState({ narrativa: "", prioridad: "media" as string, personal: "" });
  const [filters, setFilters] = useState<IncidentFilterState>({ searchText: "", priority: [], status: [], municipios: [], crimeTypes: [] });
  const [newIncidente, setNewIncidente] = useState({ tipo: "", municipio: "", colonia: "", narrativa: "", prioridad: "media" as string, personal: "" });

  const { data: municipiosData } = trpc.predicciones.obtenerMunicipios.useQuery();
  const municipios125 = municipiosData?.data || [];

  // BD query + fallback mock
  const { data: dbData, refetch } = trpc.incidentes.listar.useQuery({});
  const esReal = dbData?.origen === "real" && (dbData?.data?.length ?? 0) > 0;

  const incidentes: IncidenteUI[] = useMemo(() => {
    if (esReal && dbData) {
      return dbData.data.map(inc => ({
        id: inc.folio,
        tipo: inc.tipo,
        municipio: inc.municipio,
        colonia: inc.colonia || "",
        hora: new Date(inc.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        fecha: new Date(inc.createdAt).toLocaleDateString("es-MX"),
        estado: ESTADO_DB_TO_LABEL[inc.estado] || inc.estado,
        prioridad: PRIORIDAD_DB_TO_LABEL[inc.prioridad] || inc.prioridad,
        lat: parseFloat(inc.lat || "19.43"), lng: parseFloat(inc.lng || "-99.13"),
        narrativa: inc.narrativa,
        personal: inc.personal || "Sin asignar",
        atendido: !!inc.atendido,
        _dbId: inc.id,
      }));
    }
    return INCIDENTES_RECIENTES;
  }, [dbData, esReal]);

  const [selId, setSelId] = useState<string>("");
  const sel = incidentes.find(i => i.id === selId) || incidentes[0];

  // Si el incidente seleccionado desaparece de la lista (refetch, swap mock↔real),
  // no dejar un modal/detalle abierto mostrando en silencio un registro distinto.
  useEffect(() => {
    if (selId && !incidentes.some(i => i.id === selId)) {
      setSelId("");
      setShowModal(false);
      setShowMobileDetail(false);
    }
  }, [incidentes, selId]);

  const { filtered, count } = useIncidentSearch(incidentes, filters);

  const kpis = useMemo(() => ({
    total: incidentes.length,
    proceso: incidentes.filter(i => i.estado === "En proceso").length,
    cerrados: incidentes.filter(i => i.estado === "Cerrado").length,
    criticos: incidentes.filter(i => i.prioridad === "crítica").length,
  }), [incidentes]);

  // Mutations — requieren sesión real (protectedProcedure)
  const onMutError = (e: unknown) => {
    const code = e instanceof TRPCClientError ? e.data?.code : undefined;
    if (code === "UNAUTHORIZED") toast.error("Requiere sesión iniciada");
    else if (code === "FORBIDDEN") toast.error("Tu rol no tiene permiso para esta acción");
    else toast.error("No se pudo completar la acción");
  };
  const okOr = (data: { success: boolean; message?: string }, onOk: () => void) => {
    if (data.success) { refetch(); onOk(); }
    else toast.error(data.message || "No se pudo completar la acción — BD no disponible");
  };
  const crearMut = trpc.incidentes.crear.useMutation({
    onSuccess: d => okOr(d, () => {
      toast.success("Incidente creado.");
      setShowNewDialog(false);
      setNewIncidente({ tipo: "", municipio: "", colonia: "", narrativa: "", prioridad: "media", personal: "" });
    }),
    onError: onMutError,
  });
  const actualizarMut = trpc.incidentes.actualizar.useMutation({ onSuccess: d => okOr(d, () => toast.success("Incidente actualizado.")), onError: onMutError });
  const eliminarMut = trpc.incidentes.eliminar.useMutation({ onSuccess: d => okOr(d, () => { toast.success("Incidente eliminado."); setSelId(""); }), onError: onMutError });

  const exportQuery = trpc.incidentes.exportCsv.useQuery({}, { enabled: false });
  const handleExportarIncidentes = async () => {
    const result = await exportQuery.refetch();
    if (result.error) {
      const code = result.error instanceof TRPCClientError ? result.error.data?.code : undefined;
      toast.error(code === "UNAUTHORIZED" ? "Requiere sesión iniciada" : "No se pudo exportar");
      return;
    }
    if (!result.data?.csv) return;
    const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = result.data.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${result.data.recordCount} incidente(s) exportado(s)`);
  };

  // `_dbId` puede ser 0 en una fila real (PK reiniciada) — nunca usar `!dbId`.
  const getDbId = (i: IncidenteUI | undefined) => i?._dbId;

  const handleCrearIncidente = () => {
    if (!newIncidente.tipo || !newIncidente.municipio || !newIncidente.narrativa) {
      toast.error("Completa tipo, municipio y narrativa");
      return;
    }
    crearMut.mutate({
      tipo: newIncidente.tipo,
      municipio: newIncidente.municipio,
      colonia: newIncidente.colonia || undefined,
      narrativa: newIncidente.narrativa,
      prioridad: PRIORIDAD_LABEL_TO_DB[newIncidente.prioridad] || "media",
      personal: newIncidente.personal || undefined,
    });
    // Dialog/form se limpian solo si crearMut tiene éxito (ver onSuccess arriba) —
    // así no se pierde lo escrito si la mutación falla (ej. sesión expirada).
  };

  const handleCambiarEstado = (nuevoEstadoLabel: string) => {
    const dbId = getDbId(sel);
    if (dbId === undefined) { toast.info("Vista de demostración — inicia sesión para modificar incidentes."); return; }
    actualizarMut.mutate({ id: dbId, estado: ESTADO_LABEL_TO_DB[nuevoEstadoLabel] });
  };

  const handleToggleAtendido = () => {
    const dbId = getDbId(sel);
    if (dbId === undefined) { toast.info("Vista de demostración — inicia sesión para modificar incidentes."); return; }
    actualizarMut.mutate({ id: dbId, atendido: !sel.atendido });
  };

  const handleEliminar = () => {
    const dbId = getDbId(sel);
    if (dbId === undefined) { toast.info("Vista de demostración — inicia sesión para modificar incidentes."); return; }
    if (!confirm("¿Eliminar este incidente de la base de datos?")) return;
    eliminarMut.mutate({ id: dbId });
  };

  const handleAbrirEditar = () => {
    if (!sel) return;
    setEditIncidente({ narrativa: sel.narrativa, prioridad: sel.prioridad, personal: sel.personal === "Sin asignar" ? "" : sel.personal });
    setShowEditDialog(true);
  };

  const handleGuardarEdicion = () => {
    const dbId = getDbId(sel);
    if (dbId === undefined) { toast.info("Vista de demostración — inicia sesión para modificar incidentes."); return; }
    actualizarMut.mutate({
      id: dbId,
      narrativa: editIncidente.narrativa,
      prioridad: PRIORIDAD_LABEL_TO_DB[editIncidente.prioridad] || "media",
      personal: editIncidente.personal || undefined,
    }, {
      onSuccess: d => okOr(d, () => { toast.success("Incidente actualizado."); setShowEditDialog(false); }),
    });
  };

  const sp = sel ? priCfg(sel.prioridad) : priCfg("");
  const se = sel ? estCfg(sel.estado) : estCfg("");

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--px-bg)", padding: "var(--px-3)", gap: "var(--px-3)" }}>

      {/* ── Toolbar unificado: badge + KPIs + filtros + export (1 barra) ── */}
      {/* md:flex-wrap: sin esto, badge+4 KPIs+contador+3 botones no cabían en
          una sola fila entre ~768-900px (verificado: el boton "+ NUEVO" se
          renderizaba 11px mas alla del borde derecho del viewport, y el
          overflow-hidden del wrapper de pagina lo recortaba de forma
          permanente e inalcanzable, sin scroll). Con flex-wrap, el grupo
          derecho (contador+filtros+export+nuevo) baja a su propia linea en
          vez de desbordarse fuera de pantalla. */}
      <div className={`px-card ${showMobileDetail ? "hidden md:flex" : "flex"} flex-col md:flex-row md:flex-wrap md:items-center gap-3`} style={{ padding: "var(--px-3) var(--px-4)", flexShrink: 0 }}>
        {/* Izq: badge + KPIs */}
        <div className="flex items-center gap-3 flex-wrap">
          <OriginBadge real={esReal} />
          <div className="flex" style={{ borderRadius: "var(--px-r-sm)", overflow: "hidden", border: "1px solid var(--px-hairline)" }}>
            {[
              { l: "Total", v: kpis.total, c: "var(--px-brand)" },
              { l: "Proceso", v: kpis.proceso, c: "var(--px-warn)" },
              { l: "Cerrados", v: kpis.cerrados, c: "var(--px-ok)" },
              { l: "Críticos", v: kpis.criticos, c: "var(--px-crit)" },
            ].map((k, i, a) => (
              <div key={k.l} className="text-center" style={{ padding: "var(--px-1) var(--px-3)", borderRight: i < a.length - 1 ? "1px solid var(--px-hairline)" : "none" }}>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Der: registros + filtros + export */}
        <div className="flex items-center gap-2 md:ml-auto">
          <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{count} reg</span>
          <button onClick={() => setShowFilters(!showFilters)} aria-label="Filtros" aria-expanded={showFilters} className="px-hit44"
            style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
              background: showFilters ? "color-mix(in srgb, var(--px-brand) 15%, transparent)" : "transparent",
              color: showFilters ? "var(--px-brand)" : "var(--px-text-faint)" }}>
            <Filter size={11} className="inline mr-1" />FILTROS
            <ChevronDown size={11} className="inline ml-1" style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          <button onClick={handleExportarIncidentes} className="px-btn px-btn-secondary px-hit44" style={{ padding: "5px 10px", fontSize: "var(--px-text-xs)" }}>
            <FileText size={12} /> EXPORTAR
          </button>
          <button onClick={() => setShowNewDialog(true)} className="px-btn px-btn-primary px-hit44" style={{ padding: "5px 10px", fontSize: "var(--px-text-xs)" }}>
            <Plus size={12} /> NUEVO
          </button>
        </div>
      </div>

      {/* Filtros expandibles */}
      {showFilters && !showMobileDetail && (
        <div className="px-card px-dialog-enter" style={{ padding: "var(--px-3)", flexShrink: 0 }}>
          <AdvancedIncidentFilter onFilterChange={setFilters} initialFilters={filters} />
        </div>
      )}

      {/* ── Main: tabla + detalle ── */}
      <div className="flex flex-col md:flex-row flex-1 gap-3" style={{ minHeight: 0 }}>

        {/* Tabla / card list */}
        {/* min-w-0: dentro de un flex-row (md:flex-row) un flex item no se encoge por
            debajo de su contenido intrínseco a menos que se anule min-width:auto — sin
            esto, las columnas fijas de la fila desktop (56+56+100+80=292px + la mínima
            del 1fr) empujan todo el layout más ancho que el viewport en vez de activar
            el scroll horizontal interno (visible en md, 768-1023px, con el panel de
            Detalle abierto a su lado ocupando 320-384px fijos). */}
        <div className={`px-card flex flex-col flex-1 min-w-0 md:overflow-x-auto scrollbar-tactical ${showMobileDetail ? "hidden md:flex" : "flex"}`} style={{ minHeight: 0 }}>
          {/* Desktop header — minmax(160px,1fr) + minWidth en la fila: sin esto la
              columna flexible no tiene piso y el texto se comprime hasta ser ilegible
              antes de que el contenedor active el scroll horizontal. */}
          <div role="row" className="hidden md:grid px-4 py-2" style={{ gridTemplateColumns: "56px minmax(160px,1fr) 56px 100px 80px", minWidth: 484, borderBottom: "1px solid var(--px-hairline)", background: "rgba(0,0,0,0.1)", flexShrink: 0 }}>
            {["ID", "TIPO / MUNICIPIO", "HORA", "ESTADO", "PRIORIDAD"].map(h => (
              <span key={h} role="columnheader" className="px-eyebrow">{h}</span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-tactical" role="table" aria-label="Incidentes">
            {filtered.length === 0 && <EmptyState text="Sin incidentes con estos filtros" />}
            {filtered.map(inc => {
              const p = priCfg(inc.prioridad);
              const e = estCfg(inc.estado);
              const isSel = sel.id === inc.id;
              return (
                <div key={inc.id} role="row" aria-selected={isSel} className="cursor-pointer transition-all"
                  style={{ borderBottom: "1px solid var(--px-hairline)", background: isSel ? "color-mix(in srgb, var(--px-brand) 6%, transparent)" : "transparent", boxShadow: isSel ? "inset 3px 0 0 var(--px-brand)" : "none" }}
                  onClick={() => { setSelId(inc.id); setShowMobileDetail(true); }}>
                  {/* Mobile card — compacto */}
                  <div className="md:hidden" style={{ padding: "var(--px-2) var(--px-3)" }}>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", fontWeight: 700, color: p.color, textTransform: "uppercase" }}>{inc.prioridad}</span>
                      <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: e.color }}>{e.label}</span>
                      <span className="ml-auto" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{inc.hora}</span>
                    </div>
                    <div className="truncate" style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", fontWeight: 500, color: isSel ? "var(--px-text)" : "var(--px-text-muted)", lineHeight: 1.3, marginTop: 1 }}>{inc.tipo}</div>
                    <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginTop: 1 }}>{inc.municipio} · {inc.colonia}</div>
                  </div>
                  {/* Desktop row */}
                  <div className="hidden md:grid px-4 py-2.5 items-center" style={{ gridTemplateColumns: "56px minmax(160px,1fr) 56px 100px 80px", minWidth: 484 }}>
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-brand)" }}>{inc.id.split("-").pop()}</span>
                    <div className="min-w-0">
                      <div className="truncate" style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", fontWeight: 500, color: "var(--px-text)" }}>{inc.tipo}</div>
                      <div className="truncate" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{inc.municipio} · {inc.colonia}</div>
                    </div>
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{inc.hora}</span>
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: e.color }}>{e.label}</span>
                    <span className="px-delta" style={{ color: p.color, background: p.bg, fontSize: "var(--px-text-xs)", textTransform: "uppercase" }}>{inc.prioridad}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle */}
        <div className={`px-card shrink-0 w-full md:w-80 lg:w-96 md:overflow-y-auto scrollbar-tactical ${showMobileDetail ? "flex flex-col" : "hidden md:flex md:flex-col"}`}
          role="complementary" aria-label="Detalle del incidente" style={{ padding: "var(--px-4)", minHeight: 0 }}>

          <button onClick={() => setShowMobileDetail(false)} className="md:hidden px-btn px-btn-ghost mb-3 px-hit44" style={{ alignSelf: "flex-start", padding: "6px 12px" }}>
            <ArrowLeft size={14} /> Volver
          </button>

          {sel && (
            <>
              {/* Cabecera — sutil, no gritona */}
              <div style={{ marginBottom: "var(--px-3)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{sel.id}</span>
                  <span className="px-delta" style={{ color: sp.color, background: sp.bg, textTransform: "uppercase" }}>{sel.prioridad}</span>
                  <span className="px-delta" style={{ color: se.color, background: `color-mix(in srgb, ${se.color} 12%, transparent)` }}>{se.label}</span>
                </div>
                <h3 style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-xl)", fontWeight: 700, color: "var(--px-text)", lineHeight: 1.15 }}>
                  {sel.tipo}
                </h3>
              </div>

              {/* Metadata — líneas limpias */}
              <div style={{ marginBottom: "var(--px-3)" }}>
                {[
                  { icon: <MapPin size={13} />, label: "Ubicación", value: `${sel.municipio}, ${sel.colonia}`, color: "var(--px-brand)", bold: true },
                  { icon: <Clock size={13} />, label: "Hora", value: `${sel.hora} · ${sel.fecha}`, color: "var(--px-text-muted)", bold: false },
                  { icon: <FileText size={13} />, label: "Folio", value: sel.id, color: "var(--px-text-faint)", bold: false },
                  { icon: <TrendingUp size={13} />, label: "Coords", value: `${sel.lat}°N, ${Math.abs(sel.lng)}°W`, color: "var(--px-text-faint)", bold: false },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3" style={{ padding: "var(--px-2) 0", borderBottom: "1px solid var(--px-hairline)" }}>
                    <span style={{ color: item.bold ? item.color : "var(--px-text-faint)", flexShrink: 0 }}>{item.icon}</span>
                    <span className="px-eyebrow" style={{ width: 56, flexShrink: 0 }}>{item.label}</span>
                    <span className="truncate" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: item.color, fontWeight: item.bold ? 600 : 400 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Acciones — solo mutan filas reales; en mock avisan "vista de demostración" */}
              <div className="grid grid-cols-2 gap-2" style={{ marginBottom: "var(--px-3)" }}>
                {sel.estado !== "En proceso" && (
                  <button onClick={() => handleCambiarEstado("En proceso")} className="px-btn px-btn-secondary px-hit44" style={{ minHeight: 38, fontSize: "var(--px-text-xs)" }}>
                    <ArrowLeft size={13} /> REABRIR
                  </button>
                )}
                {sel.estado !== "Investigación" && (
                  <button onClick={() => handleCambiarEstado("Investigación")} className="px-btn px-btn-secondary px-hit44" style={{ minHeight: 38, fontSize: "var(--px-text-xs)" }}>
                    <Search size={13} /> INVESTIGACIÓN
                  </button>
                )}
                {sel.estado !== "Cerrado" && (
                  <button onClick={() => handleCambiarEstado("Cerrado")} className="px-btn px-hit44" style={{ minHeight: 38, fontSize: "var(--px-text-xs)", color: "var(--px-ok)", background: "color-mix(in srgb, var(--px-ok) 10%, transparent)", borderColor: "color-mix(in srgb, var(--px-ok) 25%, transparent)" }}>
                    <CheckCircle size={13} /> CERRAR
                  </button>
                )}
                <button onClick={handleToggleAtendido} className="px-btn px-btn-secondary px-hit44" style={{ minHeight: 38, fontSize: "var(--px-text-xs)" }}>
                  <CheckCircle size={13} /> {sel.atendido ? "MARCAR NO ATENDIDO" : "MARCAR ATENDIDO"}
                </button>
                {esReal && getDbId(sel) !== undefined && (
                  <button onClick={handleEliminar} className="px-btn px-btn-danger px-hit44" style={{ minHeight: 38, fontSize: "var(--px-text-xs)" }}>
                    <Trash2 size={13} /> ELIMINAR
                  </button>
                )}
              </div>

              <button onClick={handleAbrirEditar} className="px-btn px-btn-secondary w-full mb-2 px-hit44" style={{ minHeight: 38, fontSize: "var(--px-text-xs)" }}>
                <FileText size={13} /> EDITAR NARRATIVA / PRIORIDAD / PERSONAL
              </button>

              <button onClick={() => setShowModal(true)} className="px-btn px-btn-primary w-full mb-3 px-hit44" style={{ minHeight: 40 }}>
                <FileText size={14} /> Ver detalle completo
              </button>

              {/* Chart embebido — solo desktop */}
              <div className="hidden md:block" style={{ borderTop: "1px solid var(--px-hairline)", paddingTop: "var(--px-3)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-eyebrow">TENDENCIA</span>
                  <div className="flex gap-1">
                    {(["bar", "line"] as const).map(v => (
                      <button key={v} onClick={() => setChartView(v)} className="px-hit44" style={{
                        fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "3px 8px",
                        borderRadius: 3, border: "none", cursor: "pointer",
                        background: chartView === v ? "color-mix(in srgb, var(--px-brand) 15%, transparent)" : "transparent",
                        color: chartView === v ? "var(--px-brand)" : "var(--px-text-faint)",
                      }}>{v.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  {chartView === "bar" ? (
                    <BarChart data={DATOS_MENSUALES} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: "var(--px-text-faint)", fontSize: 8, fontFamily: "var(--px-mono)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--px-text-faint)", fontSize: 8, fontFamily: "var(--px-mono)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="robos" name="Robos" fill="var(--px-crit)" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="lesiones" name="Lesiones" fill="var(--px-warn)" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={DATOS_MENSUALES} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: "var(--px-text-faint)", fontSize: 8, fontFamily: "var(--px-mono)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--px-text-faint)", fontSize: 8, fontFamily: "var(--px-mono)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} />
                      <Line type="monotone" dataKey="robos" name="Robos" stroke="var(--px-crit)" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="lesiones" name="Lesiones" stroke="var(--px-warn)" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      <IncidentDetailModal incident={sel} isOpen={showModal} onClose={() => setShowModal(false)} />

      {/* ── Dialog: nuevo incidente ── */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-overlay" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="new-incidente-title" className="w-full max-w-lg rounded-lg mx-4 px-dialog-enter" style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)", padding: "var(--px-5)" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: "var(--px-4)" }}>
              <span id="new-incidente-title" style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-text)" }}>
                REGISTRAR NUEVO INCIDENTE
              </span>
              <button onClick={() => setShowNewDialog(false)} aria-label="Cerrar" className="px-btn px-btn-secondary px-hit44" style={{ padding: "4px 8px" }}>&#x2715;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-3)" }}>
              <div className="flex gap-2">
                {(["baja", "media", "alta", "crítica"] as const).map(pr => {
                  const pc = priCfg(pr);
                  return (
                    <button key={pr} onClick={() => setNewIncidente(p => ({ ...p, prioridad: pr }))}
                      className="px-btn flex-1 px-hit44" data-active={newIncidente.prioridad === pr}
                      style={{ color: pc.color, padding: "8px", textTransform: "uppercase", fontSize: "var(--px-text-xs)",
                        background: newIncidente.prioridad === pr ? pc.bg : "transparent",
                        borderColor: newIncidente.prioridad === pr ? pc.color : "var(--px-hairline)" }}>
                      {pr}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="px-label">TIPO *</label>
                <input value={newIncidente.tipo} onChange={e => setNewIncidente(p => ({ ...p, tipo: e.target.value }))} placeholder="Ej: Robo a transeúnte" className="px-input" style={{ minHeight: 44, boxSizing: "border-box" }} />
              </div>
              <div>
                <label className="px-label">MUNICIPIO *</label>
                <select value={newIncidente.municipio} onChange={e => setNewIncidente(p => ({ ...p, municipio: e.target.value }))} className="px-input" style={{ minHeight: 44, boxSizing: "border-box" }}>
                  <option value="">Seleccionar municipio...</option>
                  {municipios125.map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="px-label">COLONIA</label>
                <input value={newIncidente.colonia} onChange={e => setNewIncidente(p => ({ ...p, colonia: e.target.value }))} placeholder="Ej: Centro" className="px-input" style={{ minHeight: 44, boxSizing: "border-box" }} />
              </div>
              <div>
                <label className="px-label">NARRATIVA *</label>
                <textarea value={newIncidente.narrativa} onChange={e => setNewIncidente(p => ({ ...p, narrativa: e.target.value }))} placeholder="Descripción detallada del hecho..." rows={3} className="px-input" style={{ resize: "vertical" }} />
              </div>
              <div>
                <label className="px-label">PERSONAL ASIGNADO</label>
                <input value={newIncidente.personal} onChange={e => setNewIncidente(p => ({ ...p, personal: e.target.value }))} placeholder="Ej: Patrulla P-4521" className="px-input" style={{ minHeight: 44, boxSizing: "border-box" }} />
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: "var(--px-5)" }}>
              <button onClick={() => setShowNewDialog(false)} className="px-btn px-btn-secondary flex-1 px-hit44">CANCELAR</button>
              <button onClick={handleCrearIncidente} className="px-btn px-btn-primary flex-1 px-hit44">
                <FileText size={14} /> REGISTRAR INCIDENTE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog: editar incidente ── */}
      {showEditDialog && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-overlay" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-incidente-title" className="w-full max-w-lg rounded-lg mx-4 px-dialog-enter" style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)", padding: "var(--px-5)" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: "var(--px-4)" }}>
              <span id="edit-incidente-title" style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-text)" }}>
                EDITAR INCIDENTE — {sel.id}
              </span>
              <button onClick={() => setShowEditDialog(false)} aria-label="Cerrar" className="px-btn px-btn-secondary px-hit44" style={{ padding: "4px 8px" }}>&#x2715;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-3)" }}>
              <div className="flex gap-2">
                {(["baja", "media", "alta", "crítica"] as const).map(pr => {
                  const pc = priCfg(pr);
                  return (
                    <button key={pr} onClick={() => setEditIncidente(p => ({ ...p, prioridad: pr }))}
                      className="px-btn flex-1 px-hit44" data-active={editIncidente.prioridad === pr}
                      style={{ color: pc.color, padding: "8px", textTransform: "uppercase", fontSize: "var(--px-text-xs)",
                        background: editIncidente.prioridad === pr ? pc.bg : "transparent",
                        borderColor: editIncidente.prioridad === pr ? pc.color : "var(--px-hairline)" }}>
                      {pr}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="px-label">PERSONAL ASIGNADO</label>
                <input value={editIncidente.personal} onChange={e => setEditIncidente(p => ({ ...p, personal: e.target.value }))} placeholder="Ej: Patrulla P-4521" className="px-input" style={{ minHeight: 44, boxSizing: "border-box" }} />
              </div>
              <div>
                <label className="px-label">NARRATIVA</label>
                <textarea value={editIncidente.narrativa} onChange={e => setEditIncidente(p => ({ ...p, narrativa: e.target.value }))} rows={4} className="px-input" style={{ resize: "vertical" }} />
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: "var(--px-5)" }}>
              <button onClick={() => setShowEditDialog(false)} className="px-btn px-btn-secondary flex-1 px-hit44">CANCELAR</button>
              <button onClick={handleGuardarEdicion} className="px-btn px-btn-primary flex-1 px-hit44">
                <FileText size={14} /> GUARDAR CAMBIOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
