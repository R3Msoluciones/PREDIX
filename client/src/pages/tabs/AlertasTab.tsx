// ============================================================
// ALERTAS — Panel de alertas en tiempo real (PREDIX v2 · Enfoque C)
// KPI strip + lista con severity stripe + detalle con jerarquía de acciones
// ============================================================

import { useState, useMemo } from "react";
import { ALERTAS_ACTIVAS } from "@/data/securityData";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { ModuleHeader, OriginBadge, EmptyState } from "@/components/dashboard";
import {
  Bell, AlertTriangle, Info, CheckCircle, XCircle, MapPin, Clock,
  Shield, Radio, Plus, Send, UserCheck, ArrowUpCircle, Check,
  Siren, Eye, ShieldAlert, CircleDot, Trash2, Calendar,
} from "lucide-react";
import { toast } from "sonner";

type NivelFilter = "all" | "critical" | "warning" | "info" | "safe";

interface Alerta {
  id: string;
  tipo: string;
  nivel: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  hora: string;
  fecha: string;
  lat: number;
  lng: number;
  unidades: number;
  reconocida?: boolean;
  escalada?: boolean;
  resuelta?: boolean;
}

function timeAgo(hora: string): string {
  const match = hora.match(/(\d{1,2}):(\d{2})/);
  if (!match) return hora;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (/p\.?\s*m/i.test(hora) && h < 12) h += 12;
  if (/a\.?\s*m/i.test(hora) && h === 12) h = 0;
  const now = new Date();
  const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m);
  if (diff < 0) return hora;
  if (diff < 1) return "ahora";
  if (diff < 60) return `hace ${diff} min`;
  return `hace ${Math.floor(diff / 60)}h`;
}

const NIVEL_CONFIG = {
  critical: { color: "var(--px-crit)", icon: XCircle, label: "CRÍTICA", priority: 0 },
  warning: { color: "var(--px-warn)", icon: AlertTriangle, label: "ALTA", priority: 1 },
  info: { color: "var(--px-brand)", icon: Info, label: "INFO", priority: 2 },
  safe: { color: "var(--px-ok)", icon: CheckCircle, label: "RESUELTA", priority: 3 },
} as const;

function nivelCfg(nivel: string) {
  const cfg = NIVEL_CONFIG[nivel as keyof typeof NIVEL_CONFIG] ?? NIVEL_CONFIG.info;
  return {
    ...cfg,
    bg: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
    border: `color-mix(in srgb, ${cfg.color} 30%, transparent)`,
    Icon: cfg.icon,
  };
}

type DateRange = "hoy" | "7d" | "30d" | "todo";

function getDateRange(range: DateRange): { desde?: string; hasta?: string } {
  if (range === "todo") return {};
  const now = new Date();
  const hasta = now.toISOString().split("T")[0];
  const desde = new Date(now);
  if (range === "hoy") desde.setDate(desde.getDate());
  else if (range === "7d") desde.setDate(desde.getDate() - 7);
  else if (range === "30d") desde.setDate(desde.getDate() - 30);
  return { desde: desde.toISOString().split("T")[0], hasta };
}

export default function AlertasTab() {
  const [filter, setFilter] = useState<NivelFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("todo");
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showNewAlertDialog, setShowNewAlertDialog] = useState(false);
  const [newAlert, setNewAlert] = useState({ titulo: "", descripcion: "", municipio: "", nivel: "warning" as string });
  const { data: municipiosData } = trpc.predicciones.obtenerMunicipios.useQuery();
  const municipios125 = municipiosData?.data || [];

  // BD query + fallback mock
  const dateParams = getDateRange(dateRange);
  const { data: dbData, refetch } = trpc.alertas.listar.useQuery(dateParams);
  // Header/SideNav/MapaTab consultan alertas.listar SIN parámetros (distinto
  // input = distinta entrada de caché en react-query) — invalidar solo el
  // refetch local de esta pestaña no los actualizaba, se quedaban con el
  // conteo viejo hasta refrescar la página. utils.invalidate() sin input
  // refresca TODAS las variantes de alertas.listar a la vez.
  const utils = trpc.useUtils();
  const esReal = dbData?.origen === "real";
  const fallbackAlertas = useMemo(() => ALERTAS_ACTIVAS.map(a => ({
    ...a, id: a.id, reconocida: false, escalada: false, resuelta: false,
    unidades: a.unidades, nivel: a.nivel, titulo: a.titulo, descripcion: a.descripcion,
    municipio: a.municipio, hora: a.hora, fecha: a.fecha, lat: a.lat, lng: a.lng, tipo: a.tipo,
  })), []);

  const alertas: Alerta[] = useMemo(() => {
    if (esReal && dbData?.data?.length) {
      return dbData.data.map(a => ({
        id: `ALT-${String(a.id).padStart(3, "0")}`,
        tipo: a.nivel === "critical" ? "CRÍTICA" : a.nivel === "warning" ? "ALTA" : "INFO",
        nivel: a.nivel, titulo: a.titulo, descripcion: a.descripcion || "",
        municipio: a.municipio,
        hora: new Date(a.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        fecha: new Date(a.createdAt).toLocaleDateString("es-MX"),
        lat: parseFloat(a.lat || "19.43"), lng: parseFloat(a.lng || "-99.13"),
        unidades: a.unidades, reconocida: !!a.reconocida, escalada: !!a.escalada, resuelta: !!a.resuelta,
        _dbId: a.id,
      }));
    }
    return fallbackAlertas;
  }, [dbData, esReal, fallbackAlertas]);

  const [selectedId, setSelectedId] = useState<string>("");
  const selectedAlerta = alertas.find(a => a.id === selectedId) || alertas[0];
  const sel = selectedAlerta;

  const filtered = filter === "all" ? alertas : alertas.filter(a => a.nivel === filter);

  const kpis = useMemo(() => ({
    criticas: alertas.filter(a => a.nivel === "critical").length,
    sinReconocer: alertas.filter(a => !a.reconocida && !a.resuelta).length,
    activas: alertas.filter(a => !a.resuelta).length,
    resueltas: alertas.filter(a => a.resuelta).length,
  }), [alertas]);

  // Mutations — requieren sesión real (protectedProcedure); onError cubre 401/red,
  // pero el server también puede resolver con {success:false} (ej. BD caída) sin lanzar
  // excepción — onSuccess debe revisar ese campo, no solo "la promesa no rechazó".
  const onMutError = (e: unknown) => {
    const code = e instanceof TRPCClientError ? e.data?.code : undefined;
    if (code === "UNAUTHORIZED") toast.error("Requiere sesión iniciada");
    else if (code === "FORBIDDEN") toast.error("Tu rol no tiene permiso para esta acción");
    else toast.error("No se pudo completar la acción");
  };
  const okOr = (data: { success: boolean; message?: string }, onOk: () => void) => {
    refetch();
    utils.alertas.listar.invalidate();
    if (data.success) onOk();
    else toast.error(data.message || "No se pudo completar la acción — BD no disponible");
  };
  const reconocerMut = trpc.alertas.reconocer.useMutation({ onSuccess: d => okOr(d, () => toast.success("Alerta reconocida.")), onError: onMutError });
  const escalarMut = trpc.alertas.escalar.useMutation({ onSuccess: d => okOr(d, () => toast.warning("Alerta escalada a nivel CRÍTICO.")), onError: onMutError });
  const despacharMut = trpc.alertas.despachar.useMutation({ onSuccess: d => okOr(d, () => toast.info("+2 unidades despachadas.")), onError: onMutError });
  const resolverMut = trpc.alertas.resolver.useMutation({ onSuccess: d => okOr(d, () => toast.success("Alerta resuelta.")), onError: onMutError });
  const crearMut = trpc.alertas.crear.useMutation({ onSuccess: d => okOr(d, () => toast.success("Alerta creada.")), onError: onMutError });
  const eliminarMut = trpc.alertas.eliminar.useMutation({ onSuccess: d => okOr(d, () => toast.success("Alerta eliminada.")), onError: onMutError });

  const getDbId = (a: Alerta) => (a as any)._dbId as number | undefined;

  const handleReconocer = (id: string) => {
    const dbId = getDbId(alertas.find(a => a.id === id)!);
    if (dbId) reconocerMut.mutate({ id: dbId });
    else toast.info("Vista de demostración — inicia sesión para modificar alertas.");
  };
  const handleEscalar = (id: string) => {
    const dbId = getDbId(alertas.find(a => a.id === id)!);
    if (dbId) escalarMut.mutate({ id: dbId });
    else toast.info("Vista de demostración — inicia sesión para modificar alertas.");
  };
  const handleResolver = (id: string) => {
    const dbId = getDbId(alertas.find(a => a.id === id)!);
    if (dbId) resolverMut.mutate({ id: dbId });
    else toast.info("Vista de demostración — inicia sesión para modificar alertas.");
  };
  const handleDespachar = (id: string) => {
    const dbId = getDbId(alertas.find(a => a.id === id)!);
    if (dbId) despacharMut.mutate({ id: dbId, cantidad: 2 });
    else toast.info("Vista de demostración — inicia sesión para modificar alertas.");
  };
  const handleCrearAlerta = () => {
    if (!newAlert.titulo || !newAlert.municipio) { toast.error("Completa título y municipio"); return; }
    // lat/lng no se envían: el servidor resuelve la coordenada real de la
    // cabecera del municipio elegido (antes se mandaba un jitter aleatorio
    // alrededor de CDMX sin relación con el municipio real).
    crearMut.mutate({
      nivel: newAlert.nivel as "critical" | "warning" | "info",
      titulo: newAlert.titulo,
      descripcion: newAlert.descripcion,
      municipio: newAlert.municipio,
    });
    setShowNewAlertDialog(false);
    setNewAlert({ titulo: "", descripcion: "", municipio: "", nivel: "warning" });
  };

  const cfg = nivelCfg(sel.nivel);

  return (
    <div className="flex flex-col md:flex-row h-full gap-3 overflow-y-auto md:overflow-hidden" style={{ background: "var(--px-bg)", padding: "var(--px-3)" }}>
      {/* ── Panel izquierdo (en mobile: oculto si detalle abierto) ── */}
      <div className={`flex flex-col w-full md:w-64 lg:w-80 xl:w-105 shrink-0 px-card md:overflow-hidden ${showMobileDetail ? "hidden md:flex" : "flex"}`} style={{ minHeight: 0 }}>

        {/* Toolbar: título + acción + badge (1 línea compacta) */}
        <div className="flex items-center gap-2 flex-wrap" style={{ padding: "var(--px-3) var(--px-4)", borderBottom: "1px solid var(--px-hairline)" }}>
          <CircleDot size={10} className="status-pulse-red" style={{ color: "var(--px-crit)" }} />
          <span style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-md)", fontWeight: 700, color: "var(--px-text)" }}>ALERTAS</span>
          <OriginBadge real={esReal} />
          <button onClick={() => setShowNewAlertDialog(true)} className="ml-auto px-btn px-btn-primary px-hit44" style={{ padding: "5px 10px", fontSize: "var(--px-text-xs)" }}>
            <Plus size={12} /> NUEVA
          </button>
        </div>

        {/* KPIs — número → label → tendencia */}
        <div className="grid grid-cols-4" style={{ borderBottom: "1px solid var(--px-hairline)" }}>
          {[
            { label: "Crít", value: kpis.criticas, color: "var(--px-crit)", warn: kpis.criticas > 0 },
            { label: "Pend", value: kpis.sinReconocer, color: "var(--px-warn)", warn: kpis.sinReconocer > 2 },
            { label: "Activ", value: kpis.activas, color: "var(--px-brand)", warn: false },
            { label: "Resol", value: kpis.resueltas, color: "var(--px-ok)", warn: false },
          ].map((k, i, arr) => (
            <div key={k.label} className="text-center" style={{ padding: "var(--px-3) var(--px-1)", borderRight: i < arr.length - 1 ? "1px solid var(--px-hairline)" : "none", background: k.warn ? `color-mix(in srgb, ${k.color} 4%, transparent)` : "transparent" }}>
              <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xl)", fontWeight: 700, color: k.color, lineHeight: 1 }}>
                {k.value}
              </div>
              <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginTop: 3 }}>
                {k.label}
              </div>
              {k.warn && <div className="w-1 h-1 rounded-full mx-auto mt-1" style={{ background: k.color, boxShadow: `0 0 4px ${k.color}` }} />}
            </div>
          ))}
        </div>

        {/* Filtros: fecha + nivel */}
        <div className="flex gap-1 overflow-x-auto items-center scrollbar-tactical" style={{ padding: "var(--px-2) var(--px-3)" }}>
          {/* Rango de fecha */}
          <Calendar size={11} style={{ color: "var(--px-text-faint)", flexShrink: 0, marginRight: 2 }} />
          {([
            { id: "hoy" as DateRange, label: "Hoy" },
            { id: "7d" as DateRange, label: "7d" },
            { id: "30d" as DateRange, label: "30d" },
            { id: "todo" as DateRange, label: "Todo" },
          ]).map(d => (
            <button key={d.id} onClick={() => setDateRange(d.id)} className="px-hit44" style={{
              fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "3px 8px",
              borderRadius: 4, border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: dateRange === d.id ? "color-mix(in srgb, var(--px-brand) 15%, transparent)" : "transparent",
              color: dateRange === d.id ? "var(--px-brand)" : "var(--px-text-faint)",
            }}>{d.label}</button>
          ))}
          <span style={{ width: 1, height: 16, background: "var(--px-hairline)", margin: "0 4px", flexShrink: 0 }} />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-tactical" role="group" aria-label="Filtrar por nivel" style={{ padding: "0 var(--px-3) var(--px-2)" }}>
          {[
            { id: "all" as NivelFilter, label: "Todo", count: alertas.length },
            { id: "critical" as NivelFilter, label: "Crít", count: kpis.criticas },
            { id: "warning" as NivelFilter, label: "Alta", count: alertas.filter(a => a.nivel === "warning").length },
            { id: "info" as NivelFilter, label: "Info", count: alertas.filter(a => a.nivel === "info").length },
            { id: "safe" as NivelFilter, label: "OK", count: kpis.resueltas },
          ].map(f => {
            const c = f.id === "all" ? "var(--px-text-muted)" : nivelCfg(f.id).color;
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} className="px-hit44"
                style={{
                  fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "4px 8px",
                  borderRadius: 4, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  background: active ? `color-mix(in srgb, ${c} 15%, transparent)` : "transparent",
                  color: active ? c : "var(--px-text-faint)",
                  borderBottom: active ? `2px solid ${c}` : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                {f.label} {f.count}
              </button>
            );
          })}
        </div>

        {/* Lista de alertas — sin icono redundante, más espacio al título */}
        <div className="md:flex-1 md:overflow-y-auto scrollbar-tactical" role="listbox" aria-label="Lista de alertas">
          {filtered.length === 0 && <EmptyState text="Sin alertas en este filtro" />}
          {filtered.map(alerta => {
            const ac = nivelCfg(alerta.nivel);
            const isSelected = sel.id === alerta.id;
            const needsAction = !alerta.reconocida && !alerta.resuelta;
            return (
              <div
                key={alerta.id} role="option" aria-selected={isSelected}
                className="cursor-pointer transition-all"
                style={{
                  padding: "var(--px-3) var(--px-4)",
                  borderBottom: "1px solid var(--px-hairline)",
                  background: isSelected ? `color-mix(in srgb, ${ac.color} 8%, transparent)` : "transparent",
                  boxShadow: `inset ${isSelected ? 4 : 3}px 0 0 ${isSelected ? ac.color : `color-mix(in srgb, ${ac.color} 25%, transparent)`}`,
                }}
                onClick={() => { setSelectedId(alerta.id); setShowMobileDetail(true); }}
              >
                {/* Línea 1: badge + estado + hora */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", fontWeight: 700, color: ac.color, letterSpacing: "0.04em" }}>{ac.label}</span>
                  {needsAction && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ac.color, boxShadow: `0 0 6px ${ac.color}` }} />}
                  {alerta.reconocida && <CheckCircle size={10} style={{ color: "var(--px-ok)" }} />}
                  {alerta.escalada && <ArrowUpCircle size={10} style={{ color: "var(--px-crit)" }} />}
                  <span className="ml-auto" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>
                    {timeAgo(alerta.hora)}
                  </span>
                </div>
                {/* Línea 2: título (héroe del item) */}
                <div className="truncate" style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", fontWeight: 500, color: isSelected ? "var(--px-text)" : "var(--px-text-muted)", lineHeight: 1.4 }}>
                  {alerta.titulo}
                </div>
                {/* Línea 3: meta compacta */}
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginTop: 2 }}>
                  {alerta.municipio} · {alerta.unidades} uds.
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Panel derecho: detalle (en mobile: full-screen cuando seleccionado) ── */}
      <div className={`flex-1 flex flex-col overflow-y-auto scrollbar-tactical px-card ${showMobileDetail ? "flex" : "hidden md:flex"}`} aria-live="polite" style={{ minHeight: 0 }}>
        {!sel ? (
          <EmptyState text="Selecciona una alerta para ver el detalle" />
        ) : (
          <div style={{ padding: "var(--px-4)" }}>
            {/* Botón volver — solo mobile */}
            <button
              onClick={() => setShowMobileDetail(false)}
              className="md:hidden px-btn px-btn-ghost mb-3 px-hit44"
              style={{ alignSelf: "flex-start", padding: "6px 12px" }}
            >
              ← Volver a alertas
            </button>
            {/* Cabecera de alerta */}
            <div className="px-card relative overflow-hidden" style={{ padding: "var(--px-4)", marginBottom: "var(--px-4)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${cfg.color}, transparent 70%)` }} />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-md flex items-center justify-center shrink-0" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                  <cfg.Icon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: cfg.color, letterSpacing: "0.1em" }}>{sel.id}</span>
                    <span className="px-delta" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    {sel.reconocida && <span className="px-delta" style={{ color: "var(--px-ok)", background: "color-mix(in srgb, var(--px-ok) 12%, transparent)" }}>RECONOCIDA</span>}
                    {sel.escalada && <span className="px-delta" style={{ color: "var(--px-crit)", background: "color-mix(in srgb, var(--px-crit) 12%, transparent)" }}>ESCALADA</span>}
                    {sel.resuelta && <span className="px-delta" style={{ color: "var(--px-ok)", background: "color-mix(in srgb, var(--px-ok) 12%, transparent)" }}>RESUELTA</span>}
                  </div>
                  <h2 style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-xl)", fontWeight: 700, color: "var(--px-text)", lineHeight: 1.15, marginBottom: "var(--px-2)" }}>
                    {sel.titulo}
                  </h2>
                  <p style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", color: "var(--px-text-muted)", lineHeight: 1.6 }}>
                    {sel.descripcion}
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones — jerarquía: primaria → secundaria → destructiva → cierre */}
            {!sel.resuelta ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" style={{ marginBottom: "var(--px-4)" }}>
                {!sel.reconocida ? (
                  <button onClick={() => handleReconocer(sel.id)} className="px-btn px-btn-primary col-span-2 lg:col-span-1" style={{ minHeight: 44 }}>
                    <UserCheck size={15} /> RECONOCER
                  </button>
                ) : (
                  <button disabled className="px-btn col-span-2 lg:col-span-1" style={{ minHeight: 44, color: "var(--px-ok)", background: "color-mix(in srgb, var(--px-ok) 10%, transparent)", borderColor: "color-mix(in srgb, var(--px-ok) 25%, transparent)", opacity: 0.7 }}>
                    <CheckCircle size={14} /> RECONOCIDA
                  </button>
                )}
                <button onClick={() => handleDespachar(sel.id)} className="px-btn px-btn-secondary" style={{ minHeight: 44 }}>
                  <Send size={14} /> DESPACHAR +2
                </button>
                <button onClick={() => handleEscalar(sel.id)} disabled={sel.escalada} className="px-btn" style={{ minHeight: 44, color: "var(--px-warn)", background: "color-mix(in srgb, var(--px-warn) 10%, transparent)", borderColor: "color-mix(in srgb, var(--px-warn) 30%, transparent)" }}>
                  <ArrowUpCircle size={14} /> {sel.escalada ? "ESCALADA" : "ESCALAR"}
                </button>
                <button onClick={() => handleResolver(sel.id)} className="px-btn" style={{ minHeight: 44, color: "var(--px-ok)", background: "color-mix(in srgb, var(--px-ok) 8%, transparent)", borderColor: "color-mix(in srgb, var(--px-ok) 25%, transparent)" }}>
                  <CheckCircle size={14} /> RESOLVER
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4 px-card" style={{ padding: "var(--px-3)", borderColor: "color-mix(in srgb, var(--px-ok) 30%, transparent)" }}>
                <CheckCircle size={16} style={{ color: "var(--px-ok)" }} />
                <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-ok)", flex: 1 }}>Alerta resuelta — situación controlada</span>
                {esReal && getDbId(sel) && (
                  <button onClick={() => { if (confirm("¿Eliminar esta alerta de la base de datos?")) { eliminarMut.mutate({ id: getDbId(sel)! }); setSelectedId(""); } }}
                    className="px-btn px-btn-danger px-hit44" style={{ padding: "3px 8px", fontSize: "var(--px-text-xs)" }}>
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
            )}

            {/* Metadata — primarios (accionables) vs referencia */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" style={{ marginBottom: "var(--px-4)" }}>
              {/* Municipio + Unidades: accionables → destacados */}
              <div className="px-card" style={{ padding: "var(--px-3)", borderLeft: "3px solid var(--px-brand)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin size={12} style={{ color: "var(--px-brand)" }} />
                  <span className="px-eyebrow">Municipio</span>
                </div>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-brand)", fontWeight: 700 }}>{sel.municipio}</div>
              </div>
              <div className="px-card" style={{ padding: "var(--px-3)", borderLeft: "3px solid var(--px-warn)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield size={12} style={{ color: "var(--px-warn)" }} />
                  <span className="px-eyebrow">Unidades</span>
                </div>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-warn)", fontWeight: 700 }}>{sel.unidades} desplegadas</div>
              </div>
              {/* Hora + Coordenadas: referencia → tenues */}
              <div style={{ padding: "var(--px-3)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={12} style={{ color: "var(--px-text-faint)" }} />
                  <span className="px-eyebrow">Reporte</span>
                </div>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)" }}>{sel.hora} · {sel.fecha}</div>
              </div>
              <div style={{ padding: "var(--px-3)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Radio size={12} style={{ color: "var(--px-text-faint)" }} />
                  <span className="px-eyebrow">Coords</span>
                </div>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text-faint)" }}>{sel.lat.toFixed(4)}°N, {Math.abs(sel.lng).toFixed(4)}°W</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="px-card" style={{ padding: "var(--px-4)" }}>
              <ModuleHeader eyebrow="Registro de eventos" title="LÍNEA DE TIEMPO" />
              {buildTimeline(sel, cfg.color).map((item, idx, arr) => (
                <div key={idx} className="flex gap-3" style={{ marginBottom: idx < arr.length - 1 ? "var(--px-3)" : 0 }}>
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: item.color, boxShadow: `0 0 8px color-mix(in srgb, ${item.color} 50%, transparent)` }} />
                    {idx < arr.length - 1 && <div className="flex-1 w-px mt-1" style={{ background: "var(--px-hairline)", minHeight: 20 }} />}
                  </div>
                  <div className="flex-1">
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: item.color, marginRight: 8 }}>{item.time}</span>
                    <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)" }}>{item.event}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog: nueva alerta ── */}
      {showNewAlertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-overlay" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="new-alert-title" className="w-full max-w-lg rounded-lg mx-4 px-dialog-enter" style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)", padding: "var(--px-5)" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: "var(--px-4)" }}>
              <span id="new-alert-title" style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-text)" }}>
                CREAR NUEVA ALERTA
              </span>
              <button onClick={() => setShowNewAlertDialog(false)} aria-label="Cerrar" className="px-btn px-btn-secondary px-hit44" style={{ padding: "4px 8px" }}>&#x2715;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-3)" }}>
              {/* Indicador de nivel visual */}
              <div className="flex gap-2">
                {(["critical", "warning", "info"] as const).map(n => {
                  const nc = nivelCfg(n);
                  return (
                    <button key={n} onClick={() => setNewAlert(p => ({ ...p, nivel: n }))}
                      className="px-btn flex-1 px-hit44" data-active={newAlert.nivel === n}
                      style={{
                        color: nc.color, padding: "8px",
                        background: newAlert.nivel === n ? nc.bg : "transparent",
                        borderColor: newAlert.nivel === n ? nc.border : "var(--px-hairline)",
                      }}>
                      <nc.Icon size={14} /> {nc.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="px-label">TÍTULO *</label>
                <input value={newAlert.titulo} onChange={e => setNewAlert(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Operativo activo — Zona Norte" className="px-input" style={{ minHeight: 44, boxSizing: "border-box" }} />
              </div>
              <div>
                <label className="px-label">DESCRIPCIÓN</label>
                <textarea value={newAlert.descripcion} onChange={e => setNewAlert(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción detallada del evento..." rows={3} className="px-input" style={{ resize: "vertical" }} />
              </div>
              <div>
                <label className="px-label">MUNICIPIO *</label>
                <select value={newAlert.municipio} onChange={e => setNewAlert(p => ({ ...p, municipio: e.target.value }))} className="px-input" style={{ minHeight: 44, boxSizing: "border-box" }}>
                  <option value="">Seleccionar municipio...</option>
                  {municipios125.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: "var(--px-5)" }}>
              <button onClick={() => setShowNewAlertDialog(false)} className="px-btn px-btn-secondary flex-1 px-hit44">CANCELAR</button>
              <button onClick={handleCrearAlerta} className="px-btn px-btn-primary flex-1 px-hit44">
                <Bell size={14} /> CREAR ALERTA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseHora(hora: string): { h: number; m: number } {
  const match = hora.match(/(\d{1,2}):(\d{2})/);
  if (!match) return { h: 0, m: 0 };
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (/p\.?\s*m/i.test(hora) && h < 12) h += 12;
  if (/a\.?\s*m/i.test(hora) && h === 12) h = 0;
  return { h, m };
}

function buildTimeline(alerta: Alerta, alertColor: string) {
  const base = alerta.hora;
  const { h: bh, m: bm } = parseHora(base);
  const offset = (min: number) => {
    const total = bh * 60 + bm + min;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };
  const items = [
    { time: base, event: "Alerta generada por sistema ATENEA", color: alertColor },
    { time: offset(2), event: "Notificación enviada a unidades disponibles", color: "var(--px-brand)" },
  ];
  if (alerta.reconocida) items.push({ time: offset(3), event: "Reconocida por operador de turno", color: "var(--px-ok)" });
  items.push({ time: offset(5), event: `${alerta.unidades} unidades desplegadas en zona`, color: "var(--px-warn)" });
  if (alerta.escalada) items.push({ time: offset(6), event: "Escalada a nivel CRÍTICO — cadena de mando notificada", color: "var(--px-crit)" });
  items.push({ time: offset(8), event: "Primer contacto en zona de incidente", color: "var(--px-ok)" });
  if (alerta.resuelta) items.push({ time: offset(15), event: "Alerta resuelta — situación controlada", color: "var(--px-ok)" });
  return items;
}
