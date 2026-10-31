// ============================================================
// NotificationPanel — Panel de notificaciones en tiempo real
// Rediseño sobrio-institucional (F1 tokens + F2 estructura)
// ============================================================

import { useState, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Bell, X, CheckCheck, Trash2,
  AlertTriangle, ShieldAlert, FileText, Radio,
  MapPin, BarChart3, Settings
} from "lucide-react";
import type { RealtimeEvent, EventType } from "@/hooks/useRealtimeEvents";
import { HUD } from "@/lib/hudTokens";

// ── Tokens sobrio-institucional — fuente única en @/lib/hudTokens (antes
// duplicados letra por letra aquí y en Header.tsx). surface1/surface2 y
// offline son específicos de este panel (fondo del diálogo / alias de crit). ──
const T = {
  ...HUD,
  surface1: "#0E1726",
  surface2: "#0B121F",
  offline: HUD.crit,
};

function getEventIcon(type: EventType) {
  switch (type) {
    case "nueva_alerta":
    case "alerta_actualizada":
      return <ShieldAlert size={14} />;
    case "nuevo_incidente":
    case "incidente_actualizado":
      return <FileText size={14} />;
    case "cambio_estado_integracion":
      return <Settings size={14} />;
    case "elemento_posicion":
      return <MapPin size={14} />;
    case "kpi_actualizado":
      return <BarChart3 size={14} />;
    case "secreto_expirado":
      return <AlertTriangle size={14} />;
    case "sistema":
      return <Radio size={14} />;
    default:
      return <Bell size={14} />;
  }
}

// Severidad desaturada a registro institucional (sin neón).
function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return { color: "#E5484D", bg: "rgba(229,72,77,0.08)", border: "rgba(229,72,77,0.28)" };
    case "warning": return { color: "#E5A23D", bg: "rgba(229,162,61,0.08)", border: "rgba(229,162,61,0.28)" };
    case "success": return { color: "#3DA35D", bg: "rgba(61,163,93,0.08)", border: "rgba(61,163,93,0.26)" };
    default: return { color: "#7C8BA1", bg: "rgba(124,139,161,0.08)", border: "rgba(124,139,161,0.24)" };
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case "critical": return "CRÍTICO";
    case "warning": return "ALERTA";
    case "success": return "ÉXITO";
    default: return "INFO";
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 10) return "Ahora";
  if (diffSec < 60) return `Hace ${diffSec}s`;
  if (diffMin < 60) return `Hace ${diffMin}m`;
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// Agrupación temporal para divisores tipo log.
function getTimeGroup(ts: number): string {
  const diffMin = (Date.now() - ts) / 60000;
  if (diffMin < 60) return "Última hora";
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? "Hoy" : "Anterior";
}

type FilterTab = "all" | "alertas" | "incidentes" | "sistema";

// Mapea un evento a su tab de destino para deep-link (null = sin navegación).
function eventToTab(type: EventType): string | null {
  switch (type) {
    case "nueva_alerta":
    case "alerta_actualizada":
      return "alertas";
    case "nuevo_incidente":
    case "incidente_actualizado":
      return "incidentes";
    case "cambio_estado_integracion":
    case "secreto_expirado":
      return "integracion";
    case "elemento_posicion":
      return "mapa";
    case "kpi_actualizado":
      return "tablero";
    default:
      return null;
  }
}

function TimeDivider({ label, accent }: { label: string; accent?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 14px 4px",
      }}
    >
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "0.62rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: accent || T.textMeta,
          fontWeight: accent ? 700 : 400,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: "1px", background: accent ? `color-mix(in srgb, ${accent} 35%, transparent)` : T.borderSoft }} />
    </div>
  );
}

function EventItem({
  event,
  isUnread,
  onMarkRead,
  onActivate,
}: {
  event: RealtimeEvent;
  isUnread: boolean;
  onMarkRead: (id: string) => void;
  onActivate: (event: RealtimeEvent) => void;
}) {
  const severity = getSeverityColor(event.severity);
  const sevLabel = getSeverityLabel(event.severity);
  const icon = getEventIcon(event.type);
  const [hover, setHover] = useState(false);
  // Resalte neutro solo si el evento llegó hace <4s (recién montado en vivo).
  const isNewRef = useRef(Date.now() - event.timestamp < 4000);
  const isCriticalLive = event.severity === "critical" && isUnread;
  const canNavigate = eventToTab(event.type) !== null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onActivate(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(event);
        }
      }}
      role="button"
      tabIndex={0}
      title={canNavigate ? "Abrir en su módulo" : undefined}
      style={{
        position: "relative",
        padding: "11px 12px 11px 16px",
        background: hover ? T.hover : isUnread ? "rgba(255,255,255,0.015)" : "transparent",
        borderBottom: `1px solid ${T.borderSoft}`,
        opacity: isUnread ? 1 : 0.55,
        cursor: "pointer",
        outline: "none",
        transition: "background 0.2s, opacity 0.2s",
        animation: isNewRef.current ? "npHighlight 1s ease-out" : undefined,
      }}
    >
      {/* Spine de severidad */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "2px",
          background: severity.color,
          opacity: isUnread ? 1 : 0.5,
          animation: isCriticalLive ? "npSpine 1.8s ease-in-out infinite" : undefined,
        }}
      />
      <div className="flex items-start gap-2">
        <div style={{ color: severity.color, marginTop: "1px", flexShrink: 0 }}>{icon}</div>
        <div className="flex-1 min-w-0">
          {/* Línea 1: chip severidad + hora */}
          <div className="flex items-center justify-between gap-2">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontFamily: T.mono,
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.07em",
                color: severity.color,
                background: severity.bg,
                border: `1px solid ${severity.border}`,
                borderRadius: "3px",
                padding: "1px 6px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {isUnread && (
                <span
                  style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: severity.color,
                  }}
                />
              )}
              {sevLabel}
            </span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.6rem",
                color: T.textMeta,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
          {/* Línea 2: título */}
          <div
            className="truncate"
            style={{
              fontFamily: T.display,
              fontSize: "0.86rem",
              fontWeight: isUnread ? 700 : 600,
              letterSpacing: "0.01em",
              color: isUnread ? T.textTitle : T.textBody,
              marginTop: "4px",
            }}
          >
            {event.title}
          </div>
          {/* Línea 3: mensaje (sans, 2 líneas) */}
          <p
            className="np-clamp2"
            style={{
              fontFamily: T.sans,
              fontSize: "0.72rem",
              lineHeight: 1.45,
              color: T.textBody,
              marginTop: "3px",
            }}
          >
            {event.message}
          </p>
          {/* Acción al hover: marcar leído (solo si no leído) */}
          {isUnread && hover && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(event.id);
              }}
              style={{
                marginTop: "7px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: "4px",
                padding: "2px 8px",
                cursor: "pointer",
                color: T.textBody,
                fontFamily: T.mono,
                fontSize: "0.62rem",
              }}
            >
              <CheckCheck size={11} /> Marcar leído
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const {
    events, connected, unreadCount, unreadIds,
    markAllRead, markRead, clearHistory,
    alertEvents, incidentEvents, systemEvents,
  } = useNotifications();

  const filteredEvents = (() => {
    switch (activeFilter) {
      case "alertas": return alertEvents;
      case "incidentes": return incidentEvents;
      case "sistema": return systemEvents;
      default: return events;
    }
  })();

  // Ordenar por más reciente primero
  const sortedEvents = [...filteredEvents].reverse();

  // Eventos críticos sin leer se fijan arriba de todo — no dependen del
  // filtro de tiempo, así una alerta grave no queda enterrada bajo una
  // racha de eventos de sistema menores.
  const priorityEvents = sortedEvents.filter((e) => e.severity === "critical" && unreadIds.has(e.id));
  const priorityIds = new Set(priorityEvents.map((e) => e.id));
  const restEvents = sortedEvents.filter((e) => !priorityIds.has(e.id));

  // Color del badge de la campana según la severidad más alta SIN LEER (no
  // siempre rojo) — un solo "info" sin leer no debe verse igual de urgente
  // que un crítico sin leer.
  const badgeSeverity: "critical" | "warning" | "info" = (() => {
    const unread = events.filter((e) => unreadIds.has(e.id));
    if (unread.some((e) => e.severity === "critical")) return "critical";
    if (unread.some((e) => e.severity === "warning")) return "warning";
    return "info";
  })();
  const badgeColor = badgeSeverity === "critical" ? T.crit : badgeSeverity === "warning" ? T.warn : T.brand;

  const filters: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: events.length },
    { id: "alertas", label: "Alertas", count: alertEvents.length },
    { id: "incidentes", label: "Incidentes", count: incidentEvents.length },
    { id: "sistema", label: "Sistema", count: systemEvents.length },
  ];

  const [confirmClear, setConfirmClear] = useState(false);

  // Reacción de campana: animar solo cuando SUBE el contador (llega evento).
  // Vía Web Animations API sobre refs — NO usar `key` para re-disparar (mezclar
  // hermanos keyed/unkeyed remontaba spans y apilaba bells).
  const prevUnread = useRef(unreadCount);
  const bellRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        bellRef.current?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.22)", offset: 0.3 },
            { transform: "scale(0.94)", offset: 0.65 },
            { transform: "scale(1)" },
          ],
          { duration: 500, easing: "ease-out" },
        );
        badgeRef.current?.animate(
          [
            { transform: "scale(0.7)" },
            { transform: "scale(1.18)", offset: 0.6 },
            { transform: "scale(1)" },
          ],
          { duration: 300, easing: "ease-out" },
        );
      }
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  // Esc cierra el panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Auto-refresca timestamps relativos ("Hace 30s") cada 30s mientras está abierto.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [isOpen]);

  // Resetea la confirmación de borrado al cerrar.
  useEffect(() => {
    if (!isOpen) setConfirmClear(false);
  }, [isOpen]);

  // Deep-link: marca leído y navega al módulo del evento.
  const handleActivate = (event: RealtimeEvent) => {
    markRead(event.id);
    const tab = eventToTab(event.type);
    if (tab) {
      window.dispatchEvent(new CustomEvent("predix:navigate-tab", { detail: tab }));
      setIsOpen(false);
    }
  };

  // Render de lista con divisores temporales.
  let lastGroup: string | null = null;

  const emptyMsg: Record<FilterTab, string> = {
    all: "Sin eventos por ahora",
    alertas: "Sin alertas",
    incidentes: "Sin incidentes",
    sistema: "Sin eventos de sistema",
  };

  return (
    <>
      {/* Bell Button con Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative px-hit44"
        aria-label="Notificaciones en tiempo real"
        style={{
          background: isOpen ? "rgba(255,255,255,0.08)" : "transparent",
          border: `1px solid ${isOpen ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "8px",
          padding: "6px 10px",
          cursor: "pointer",
          transition: "all 0.2s",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          ref={bellRef}
          style={{
            display: "inline-flex",
            transformOrigin: "50% 0%",
          }}
        >
          <Bell size={15} color="#E8F0FE" />
        </span>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            ref={badgeRef}
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: badgeColor,
              color: "#fff",
              fontSize: "0.6rem",
              fontFamily: T.mono,
              fontWeight: 700,
              borderRadius: "10px",
              padding: "1px 5px",
              minWidth: "16px",
              textAlign: "center",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Overlay vía portal a document.body — escapa del containing-block que
          crea el `backdrop-filter` del Header; así `position:fixed` es relativo
          al viewport y no se corta. */}
      {isOpen && createPortal(
        <div
          className="np-overlay"
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            animation: "npFade 0.2s ease-out",
          }}
        >
          <div
            role="dialog"
            aria-label="Notificaciones en tiempo real"
            onClick={(e) => e.stopPropagation()}
            className="np-dialog"
            style={{
              background: `linear-gradient(180deg, ${T.surface1} 0%, ${T.surface2} 100%)`,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "npPop 0.18s ease-out",
            }}
          >
            {/* Header (con stats fusionadas) */}
            <div
              style={{
                padding: "12px 14px",
                borderBottom: `1px solid ${T.border}`,
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Radio size={15} color="#8C9BB3" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontFamily: T.display,
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      color: T.textTitle,
                      letterSpacing: "0.1em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    TIEMPO REAL
                  </span>
                  <span
                    className="flex items-center gap-1"
                    style={{
                      background: connected ? "rgba(61,163,93,0.1)" : "rgba(229,72,77,0.1)",
                      border: `1px solid ${connected ? "rgba(61,163,93,0.25)" : "rgba(229,72,77,0.25)"}`,
                      borderRadius: "4px",
                      padding: "1px 7px",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: connected ? T.live : T.offline,
                        animation: connected ? "npLive 2.4s ease-in-out infinite" : undefined,
                      }}
                    />
                    <span style={{ fontFamily: T.mono, fontSize: "0.62rem", color: connected ? T.live : T.offline }}>
                      {connected ? "En línea" : "Sin conexión"}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                  <button
                    onClick={markAllRead}
                    title="Marcar todo como leído"
                    aria-label="Marcar todo como leído"
                    style={iconBtn}
                  >
                    <CheckCheck size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmClear(true)}
                    title="Limpiar historial"
                    aria-label="Limpiar historial"
                    style={iconBtn}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    title="Cerrar"
                    aria-label="Cerrar"
                    style={iconBtn}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              {/* Stats inline */}
              <div
                style={{
                  marginTop: "7px",
                  fontFamily: T.mono,
                  fontSize: "0.62rem",
                  color: T.textMeta,
                }}
              >
                {sortedEvents.length} eventos
                <span style={{ opacity: 0.5 }}> · </span>
                {unreadCount} sin leer
              </div>
            </div>

            {/* Confirmación de limpiar historial */}
            {confirmClear && (
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "8px 14px",
                  borderBottom: `1px solid ${T.border}`,
                  background: "rgba(229,72,77,0.06)",
                }}
              >
                <span style={{ fontFamily: T.sans, fontSize: "0.7rem", color: T.textBody }}>
                  ¿Limpiar todo el historial?
                </span>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <button
                    onClick={() => setConfirmClear(false)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      borderRadius: "4px",
                      padding: "2px 9px",
                      cursor: "pointer",
                      color: T.textBody,
                      fontFamily: T.mono,
                      fontSize: "0.62rem",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      clearHistory();
                      setConfirmClear(false);
                    }}
                    style={{
                      background: "rgba(229,72,77,0.14)",
                      border: "1px solid rgba(229,72,77,0.4)",
                      borderRadius: "4px",
                      padding: "2px 9px",
                      cursor: "pointer",
                      color: "#E5484D",
                      fontFamily: T.mono,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex" style={{ padding: "0 6px", borderBottom: `1px solid ${T.border}` }}>
              {filters.map(f => {
                const active = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    title={`${f.label} (${f.count})`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      padding: "9px 4px",
                      border: "none",
                      borderBottom: `2px solid ${active ? T.textActive : "transparent"}`,
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: T.mono,
                      fontSize: "0.6rem",
                      fontWeight: active ? 700 : 500,
                      color: active ? T.textActive : T.textMeta,
                      transition: "color 0.2s, border-color 0.2s",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</span>
                    {f.count > 0 && (
                      <span
                        style={{
                          flexShrink: 0,
                          minWidth: "17px",
                          padding: "1px 5px",
                          borderRadius: "999px",
                          fontFamily: T.mono,
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          lineHeight: 1.5,
                          textAlign: "center",
                          color: active ? T.surface1 : T.textBody,
                          background: active ? T.textActive : "rgba(255,255,255,0.09)",
                        }}
                      >
                        {f.count > 99 ? "99+" : f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Events List */}
            <div className="np-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <div key={activeFilter} style={{ animation: "npFade 0.22s ease-out" }}>
              {sortedEvents.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center"
                  style={{ padding: "44px 20px", textAlign: "center" }}
                >
                  <Radio size={30} color="rgba(139,163,199,0.3)" />
                  <p style={{ fontFamily: T.display, fontSize: "0.85rem", color: T.textBody, marginTop: "12px", letterSpacing: "0.04em" }}>
                    {emptyMsg[activeFilter]}
                  </p>
                  <p style={{ fontFamily: T.sans, fontSize: "0.7rem", color: T.textMeta, marginTop: "4px" }}>
                    Las notificaciones aparecerán automáticamente
                  </p>
                </div>
              ) : (
                <>
                  {priorityEvents.length > 0 && (
                    <>
                      <TimeDivider label={`⚠ Prioridad · ${priorityEvents.length}`} accent={T.crit} />
                      {priorityEvents.map(event => (
                        <EventItem
                          key={event.id}
                          event={event}
                          isUnread={true}
                          onMarkRead={markRead}
                          onActivate={handleActivate}
                        />
                      ))}
                    </>
                  )}
                  {restEvents.map(event => {
                    const group = getTimeGroup(event.timestamp);
                    const showDivider = group !== lastGroup;
                    lastGroup = group;
                    return (
                      <Fragment key={event.id}>
                        {showDivider && <TimeDivider label={group} />}
                        <EventItem
                          event={event}
                          isUnread={unreadIds.has(event.id)}
                          onMarkRead={markRead}
                          onActivate={handleActivate}
                        />
                      </Fragment>
                    );
                  })}
                </>
              )}
              </div>
            </div>

            {/* Footer sobrio */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: "8px 14px",
                borderTop: `1px solid ${T.border}`,
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <span className="flex items-center gap-2" style={{ fontFamily: T.mono, fontSize: "0.62rem", color: T.textMeta }}>
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: connected ? T.live : T.offline,
                  }}
                />
                Canal SSE · {connected ? "en vivo" : "sin conexión"}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "0.62rem", color: T.textMeta }}>
                Actualización automática
              </span>
            </div>
          </div>
          {/* Caret apuntando al bell (solo desktop / popover anclado) */}
          <div className="np-caret" aria-hidden />
        </div>,
        document.body
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes npFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes npPop {
          from { transform: translateY(8px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes npHighlight {
          0% { background: rgba(255,255,255,0.08); }
          100% { background: rgba(255,255,255,0); }
        }
        @keyframes npLive {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes npSpine {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        /* Overlay responsive scroll-safe: móvil = centrado real; desktop = top-right.
           backdrop con overflow-y:auto + dialog con margin:auto → si el contenido
           excede el alto, el overlay SCROLLEA en vez de cortar el top. Sin JS/transform. */
        .np-overlay {
          display: flex;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 16px;
          background: rgba(2,6,14,0.35);   /* móvil: scrim ligero */
          backdrop-filter: blur(1px);
        }
        .np-dialog {
          margin: auto;                 /* centrado ambos ejes, scroll-safe */
          width: min(420px, 100%);
          /* Altura ESTABLE: la lista no se redimensiona al llegar notifs, solo scrollea. */
          height: min(600px, 100dvh - 32px);
        }
        /* Fallback si dvh no está soportado: usa vh */
        @supports not (height: 100dvh) {
          .np-dialog { height: min(600px, 100vh - 32px); }
        }
        .np-caret { display: none; }
        @media (min-width: 768px) {
          /* Desktop: popover anclado top-right, SIN backdrop oscuro (no tapa datos vivos) */
          .np-overlay {
            padding: 66px 16px 16px;
            background: transparent;
            backdrop-filter: none;
          }
          .np-dialog {
            margin: 0 0 auto auto;      /* top-right */
            height: min(600px, 100dvh - 98px);
          }
          @supports not (height: 100dvh) {
            .np-dialog { height: min(600px, 100vh - 98px); }
          }
          .np-caret {
            display: block;
            position: fixed;
            top: 59px;
            right: 26px;
            width: 0;
            height: 0;
            border-left: 7px solid transparent;
            border-right: 7px solid transparent;
            border-bottom: 8px solid ${T.surface1};
            z-index: 9999;
            filter: drop-shadow(0 -1px 0 rgba(255,255,255,0.10));
          }
        }
        .np-clamp2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .np-scroll::-webkit-scrollbar { width: 6px; }
        .np-scroll::-webkit-scrollbar-track { background: transparent; }
        .np-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 3px;
        }
        .np-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.22);
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="npHighlight"], [style*="npLive"], [style*="npSpine"],
          [style*="npPop"], [style*="npFade"] { animation: none !important; }
        }
      `}</style>
    </>
  );
}

const iconBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  color: "#8BA3C7",
  display: "inline-flex",
  borderRadius: "4px",
};
