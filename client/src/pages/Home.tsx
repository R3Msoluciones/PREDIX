// ============================================================
// HOME — Página principal del sistema PREDIX
// Integra Header + TabNav + 10 módulos de seguridad pública
// Design: Command Center / Tactical Intelligence
// ============================================================

import { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import Header from "@/components/Header";
import { type TabId, TAB_IDS, canAccessTab } from "@/components/navConfig";
import SideNav, { COLLAPSE_KEY } from "@/components/SideNav";
import { useAccessibleModules } from "@/hooks/useModuleAccess";
import MapaTab from "./tabs/MapaTab";
import AlertasTab from "./tabs/AlertasTab";
import IncidentesTab from "./tabs/IncidentesTab";
import PrediccionesTab from "./tabs/PrediccionesTab";
import TableroTab from "./tabs/TableroTab";
import ZonasTab from "./tabs/ZonasTab";
import ChatbotTab from "./tabs/ChatbotTab";
import IntegracionTab from "./tabs/IntegracionTab";
import AdminTab from "./tabs/AdminTab";

export default function Home() {
  const { modules, isLoading: modulesLoading } = useAccessibleModules();
  const accessibleModules = modulesLoading ? null : modules;
  const [activeTab, setActiveTab] = useState<TabId>("tablero");

  // Si los módulos accesibles no alcanzan para el tab actual (p.ej. un rol sin
  // acceso a Sistema), regresa al Tablero. Defensa contra deep-links.
  useEffect(() => {
    if (!modulesLoading && !canAccessTab(accessibleModules, activeTab)) setActiveTab("tablero");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulesLoading, accessibleModules?.join(","), activeTab]);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  const handleCollapsed = (c: boolean) => {
    setCollapsed(c);
    localStorage.setItem(COLLAPSE_KEY, c ? "1" : "0");
  };

  // Deep-link desde el panel de notificaciones (CustomEvent desacoplado).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (TAB_IDS.includes(detail as TabId) && canAccessTab(accessibleModules, detail as TabId)) {
        setActiveTab(detail as TabId);
      }
    };
    window.addEventListener("predix:navigate-tab", handler);
    return () => window.removeEventListener("predix:navigate-tab", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessibleModules?.join(",")]);

  // Mide la altura REAL del header y la publica en --px-header-h. Así el rail
  // y el contenido se alinean aunque el header crezca (fuentes, wrap, zoom).
  // El 58px del CSS queda solo como fallback antes del primer paint.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const apply = () =>
      document.documentElement.style.setProperty("--px-header-h", `${header.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const renderTab = () => {
    // Defensa en profundidad: si los módulos accesibles no alcanzan, no lo montamos.
    if (!canAccessTab(accessibleModules, activeTab)) {
      return (
        <div className="flex flex-col items-center justify-center h-[55vh] gap-4 text-center px-4">
          <ShieldAlert className="w-12 h-12 text-amber-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Acceso restringido</h2>
            <p className="text-sm text-slate-400 max-w-md mt-1">
              Tu rol no tiene acceso a este módulo.
            </p>
          </div>
        </div>
      );
    }
    switch (activeTab) {
      case "mapa": return <MapaTab />;
      case "alertas": return <AlertasTab />;
      case "incidentes": return <IncidentesTab />;
      case "predicciones": return <PrediccionesTab />;
      case "tablero": return <TableroTab />;
      case "zonas": return <ZonasTab />;
      case "chatbot": return <ChatbotTab />;
      case "integracion": return <IntegracionTab />;
      case "admin": return <AdminTab />;
      default: return <TableroTab />;
    }
  };

  return (
    <div
      className={`px-app${collapsed ? " is-rail-collapsed" : ""}`}
      style={{
        minHeight: "100vh",
        background: "var(--px-bg)",
        backgroundImage: `
          linear-gradient(var(--px-bg-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--px-bg-grid) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    >
      {/* Header fijo (barra de estado superior) */}
      <Header />

      {/* Rail de módulos (sidebar) — fijo a la izquierda */}
      <SideNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={collapsed}
        onCollapsedChange={handleCollapsed}
      />

      {/* Contenido del módulo activo */}
      <main className="px-main flex flex-col">
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {renderTab()}
        </div>
      </main>

      {/* Footer bar — oculto en móvil por CSS (.px-legal-footer) */}
      <div
        className="px-legal-footer flex items-center justify-between px-4 py-1.5"
        style={{
          background: "rgba(6,14,28,0.98)",
          borderTop: "1px solid rgba(0,212,255,0.1)",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
        }}
      >
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
            SISTEMA ESTATAL DE INTELIGENCIA PARA SEGURIDAD PÚBLICA
          </span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
            |
          </span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
            GOBIERNO DEL ESTADO DE MÉXICO
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
            DEMO v1.0 · USO OFICIAL
          </span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
            |
          </span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
            DATOS SIMULADOS CON FINES DEMOSTRATIVOS
          </span>
        </div>
      </div>
    </div>
  );
}
