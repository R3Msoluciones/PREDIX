// ============================================================
// HEADER — Command Center / Tactical Intelligence
// Barra superior con logo, estado del sistema y controles
// Cierre de sesión funcional + Configuración de perfil
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, ChevronDown, Activity, Radio } from "lucide-react";
import { useLocation } from "wouter";
import UserPanel, { type UserProfile } from "./UserPanel";
import NotificationPanel from "./NotificationPanel";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { INSTITUTIONAL_ROLE_LABELS, ROLE_LABEL_TO_SLUG, ROLE_COLORS } from "@/lib/institutionalRoles";
import { HUD } from "@/lib/hudTokens";

// Tokens sobrio-institucional — fuente única en @/lib/hudTokens (antes
// duplicados letra por letra aquí y en NotificationPanel.tsx).
// Cian = solo acento de marca puntual; el color lo carga la severidad/estado.
const HX = HUD;

// Chip que ancla cada KPI (cuadro redondeado tintado por semántica).
function chip(bg: string, border: string): React.CSSProperties {
  return {
    width: "28px",
    height: "28px",
    borderRadius: "7px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: bg,
    border: `1px solid ${border}`,
    flexShrink: 0,
  };
}

export default function Header() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStatus] = useState("OPERATIVO");
  const [showUserPanel, setShowUserPanel] = useState(false);

  // Alertas activas reales: cuenta las no resueltas de alertas.listar (misma
  // fuente que AlertasTab, react-query dedupea la query si ya está en caché).
  const { data: alertasResp } = trpc.alertas.listar.useQuery();
  const activeAlerts = (alertasResp?.data ?? []).filter(a => !a.resuelta).length;
  const alertCrit = activeAlerts >= 10;
  const alertColor = alertCrit ? HX.crit : activeAlerts > 0 ? HX.warn : HX.textMeta;
  const alertChipBg = alertCrit ? "rgba(229,72,77,0.12)" : "rgba(229,162,61,0.12)";
  const alertChipBorder = alertCrit ? "rgba(229,72,77,0.28)" : "rgba(229,162,61,0.28)";

  // Flash al cambiar el KPI de alertas (WAAPI, mismo patrón del bell).
  const alertNumRef = useRef<HTMLSpanElement>(null);
  const prevAlerts = useRef(activeAlerts);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const flash = (el: HTMLElement | null) => {
      if (!el || reduce) return;
      el.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.18)", offset: 0.5 }, { transform: "scale(1)" }],
        { duration: 320, easing: "ease-out" },
      );
    };
    if (activeAlerts !== prevAlerts.current) { flash(alertNumRef.current); prevAlerts.current = activeAlerts; }
  }, [activeAlerts]);

  // ── Auth hook for real logout ──
  const { user: authUser, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  // Build user profile from real session data (auth.me). El fallback solo se
  // ve en el instante entre montar Home y que auth.me resuelva — RequireAuth
  // (App.tsx) ya garantiza que si se llegó aquí hay sesión real.
  const user: UserProfile = authUser
    ? {
        nombre: authUser.name || "Usuario PREDIX",
        rol: INSTITUTIONAL_ROLE_LABELS[authUser.institutionalRole] || authUser.institutionalRole,
        correo: authUser.email || "usuario@seguridad.edomex.gob.mx",
        unidad: authUser.department || authUser.institution || "Sin asignar",
        ultimaConexion: authUser.lastSignedIn
          ? new Date(authUser.lastSignedIn).toLocaleString("es-MX", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })
          : "—",
        estado: authUser.status === "active" ? "activo" : "inactivo",
        cargo: INSTITUTIONAL_ROLE_LABELS[authUser.institutionalRole] || authUser.institutionalRole,
        employeeId: authUser.employeeId || undefined,
      }
    : {
        nombre: "Usuario PREDIX",
        rol: "Operador",
        correo: "—",
        unidad: "—",
        ultimaConexion: "—",
        estado: "inactivo",
        cargo: "—",
      };

  // Mismo color por rol que usa la credencial (UserPanel) y las tablas de
  // Admin — el disparador ya anticipa el tinte que vas a ver al abrir el panel.
  const roleSlugHeader = ROLE_LABEL_TO_SLUG[user.rol];
  const roleColorHeader = (roleSlugHeader && ROLE_COLORS[roleSlugHeader]) || HX.textTitle;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  // ── Logout handler ──
  const handleLogout = useCallback(async () => {
    try {
      if (isAuthenticated) {
        await logout();
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, logout, navigate]);

  // ── Settings handler ──
  const handleSettings = useCallback(() => {
    // Settings are handled inside UserPanel's settings view
    // This callback is kept for extensibility
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showUserPanel && !target.closest("[data-user-panel]")) {
        setShowUserPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserPanel]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "linear-gradient(180deg, rgba(11,18,31,0.98) 0%, rgba(14,23,38,0.96) 100%)",
        borderBottom: `1px solid ${HX.border}`,
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Top accent line — único acento de marca, sutil */}
      <div
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.45) 50%, transparent 100%)",
        }}
      />

      <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2" style={{ minHeight: "56px" }}>
        {/* LEFT: Logo + Identity */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Riel de marca — origen del acento que recorre la composición */}
          <span
            aria-hidden
            style={{
              width: "3px",
              height: "34px",
              borderRadius: "2px",
              background: "linear-gradient(180deg, #00D4FF 0%, rgba(0,212,255,0.15) 100%)",
              boxShadow: "0 0 8px rgba(0,212,255,0.4)",
              flexShrink: 0,
            }}
          />
          <div className="relative">
            <Shield
              className="w-9 h-9"
              style={{ color: HX.brand, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
              aria-label="Escudo Seguridad EdoMex"
            />
          </div>
          <div className="min-w-0">
            {/* Marca destacada + descriptor secundario */}
            <div className="flex items-baseline gap-2 leading-tight min-w-0">
              <span
                style={{
                  fontFamily: HX.display,
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: HX.textTitle,
                  letterSpacing: "0.14em",
                  flexShrink: 0,
                }}
              >
                PREDIX
              </span>
              <span className="hidden md:block" style={{ width: "1px", height: "13px", background: HX.border, flexShrink: 0 }} />
              <span
                className="hidden md:block truncate"
                style={{
                  fontFamily: HX.display,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: HX.textBody,
                  letterSpacing: "0.06em",
                }}
              >
                Sistema Estatal de Inteligencia
              </span>
            </div>
            <div
              className="hidden sm:block truncate"
              style={{
                fontFamily: HX.mono,
                fontSize: "0.6rem",
                color: HX.textMeta,
                letterSpacing: "0.08em",
                marginTop: "1px",
              }}
            >
              SEGURIDAD PÚBLICA · ESTADO DE MÉXICO
            </div>
          </div>
        </div>

        {/* CENTER: KPIs operativos agrupados (adaptativo) */}
        <div
          className="hidden sm:flex items-center gap-3.5 md:gap-5 px-2.5 sm:px-4 shrink-0"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)",
            border: `1px solid ${HX.border}`,
            borderRadius: "10px",
            paddingTop: "5px",
            paddingBottom: "5px",
            minWidth: 0,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          {/* Estado del sistema */}
          <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
            <span className="status-pulse-green" style={chip("rgba(61,163,93,0.12)", "rgba(61,163,93,0.28)")}>
              <Radio size={15} style={{ color: HX.live }} />
            </span>
            <span className="hidden lg:inline" style={{ fontFamily: HX.mono, fontSize: "0.66rem", color: HX.live, letterSpacing: "0.1em" }}>
              {systemStatus}
            </span>
          </div>

          <div className="hidden sm:block" style={{ width: "1px", height: "26px", background: HX.borderSoft, flexShrink: 0 }} />

          {/* Alertas activas (KPI con color reactivo + tendencia) */}
          <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
            <span style={chip(alertChipBg, alertChipBorder)}>
              <Activity size={15} style={{ color: alertColor }} />
            </span>
            <div className="leading-none">
              <div className="flex items-baseline gap-1.5">
                <span ref={alertNumRef} style={{ display: "inline-block", fontFamily: HX.display, fontSize: "1.05rem", fontWeight: 700, color: alertColor, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {activeAlerts}
                </span>
              </div>
              <div className="hidden lg:block" style={{ fontFamily: HX.mono, fontSize: "0.62rem", color: HX.textMeta, letterSpacing: "0.1em", marginTop: "3px" }}>
                ALERTAS ACTIVAS
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Time + Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Clock (pill, cohesión con KPIs) */}
          <div
            className="text-right"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)",
              border: `1px solid ${HX.border}`,
              borderRadius: "10px",
              padding: "4px 10px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                fontFamily: HX.mono,
                fontSize: "0.9rem",
                fontWeight: 600,
                color: HX.textTitle,
                letterSpacing: "0.05em",
                lineHeight: 1.2,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {formatTime(currentTime)}
            </div>
            <div
              className="hidden sm:block"
              style={{
                fontFamily: HX.mono,
                fontSize: "0.62rem",
                color: HX.textMeta,
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              {formatDate(currentTime)}
            </div>
          </div>

          {/* Divisor */}
          <div className="hidden sm:block" style={{ width: "1px", height: "26px", background: HX.borderSoft }} />

          {/* Notifications — Real-time panel */}
          <NotificationPanel />

          {/* User */}
          <div className="relative block" data-user-panel>
            <button
              onClick={() => setShowUserPanel(!showUserPanel)}
              className="flex items-center gap-2 px-2 py-1 rounded transition-all px-hit44"
              style={{
                background: showUserPanel ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${HX.border}`,
              }}
            >
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold"
                style={{
                  background: `color-mix(in srgb, ${roleColorHeader} 16%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${roleColorHeader} 45%, transparent)`,
                  color: roleColorHeader,
                  fontFamily: HX.display,
                }}
              >
                {user.nombre.substring(0, 2).toUpperCase()}
              </div>
              <span
                className="hidden md:inline"
                style={{
                  fontFamily: HX.mono,
                  fontSize: "0.65rem",
                  color: HX.textMeta,
                }}
              >
                {user.rol.toUpperCase()}
              </span>
              <ChevronDown
                size={10}
                className="hidden md:block"
                style={{
                  color: HX.textMeta,
                  transform: showUserPanel ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>
            {showUserPanel && (
              <UserPanel
                user={user}
                onClose={() => setShowUserPanel(false)}
                onLogout={handleLogout}
                onSettings={handleSettings}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
