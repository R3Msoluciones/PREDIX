// ============================================================
// SIDE NAV — Rail vertical de módulos (PREDIX v2)
// Ancla de marca + 3 grupos (Operación/Inteligencia/Sistema) +
// estado activo refinado + footer de sincronización + tooltips
// flotantes al colapsar. Drawer en móvil. Cian = solo acento.
// ============================================================

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Shield, PanelLeftClose, PanelLeftOpen, Menu, X } from "lucide-react";
import { type TabId, type NavItem, type NavGroup, groupsForModules } from "./navConfig";
import { useAccessibleModules } from "@/hooks/useModuleAccess";
import { trpc } from "@/lib/trpc";

/** Alertas no resueltas / incidentes abiertos — mismas fuentes reales que sus tabs. */
function useNavBadges(): { alertas: number; incidentes: number } {
  const { data: alertasResp } = trpc.alertas.listar.useQuery();
  const { data: incidentesResp } = trpc.incidentes.listar.useQuery({});
  const alertas = (alertasResp?.data ?? []).filter((a) => !a.resuelta).length;
  const incidentes = (incidentesResp?.data ?? []).filter((i) => i.estado !== "cerrado").length;
  return { alertas, incidentes };
}

// Inyecta los badges reales sobre los items de navegación (navConfig.tsx solo
// tiene la estructura estática) — sin badge (undefined) cuando el conteo es 0.
function withRealBadges(groups: NavGroup[], badges: { alertas: number; incidentes: number }): NavGroup[] {
  return groups.map((g) => ({
    ...g,
    items: g.items.map((item) => {
      if (item.id === "alertas") return { ...item, badge: badges.alertas || undefined, badgeColor: "var(--px-warn)" };
      if (item.id === "incidentes") return { ...item, badge: badges.incidentes || undefined, badgeColor: "var(--px-warn)" };
      return item;
    }),
  }));
}

// Contenedor scrollable con barra invisible + fades de borde (arriba/abajo)
// que aparecen solo cuando hay contenido oculto en esa dirección.
function ScrollFade({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const check = () => {
    if (!ref) return;
    setEdges({
      top: ref.scrollTop > 4,
      bottom: ref.scrollTop + ref.clientHeight < ref.scrollHeight - 4,
    });
  };
  // Recalcula al montar y cuando cambia el tamaño/contenido (p.ej. colapsar).
  useEffect(() => {
    if (!ref) return;
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(ref);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return (
    <div className={`px-scrollfade${className ? " " + className : ""}`}>
      <div className="px-scrollfade-scroll" ref={setRef} onScroll={check}>
        {children}
      </div>
      <div className="px-scrollfade-edge px-scrollfade-top" data-show={edges.top} aria-hidden />
      <div className="px-scrollfade-edge px-scrollfade-bottom" data-show={edges.bottom} aria-hidden />
    </div>
  );
}

const COLLAPSE_KEY = "predix-sidenav-collapsed";

interface SideNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** false en tablet: el rail queda forzado a iconos, sin botón de colapsar. */
  canToggle?: boolean;
}

function NavButton({ item, active, showLabel, onClick }: {
  item: NavItem; active: boolean; showLabel: boolean; onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      data-active={active}
      data-tip={item.label}
      onClick={onClick}
      className="px-nav-item"
      style={{ justifyContent: showLabel ? "flex-start" : "center" }}
    >
      <span className="px-nav-ico">{item.icon}</span>
      {showLabel && <span className="px-nav-label flex-1 text-left truncate">{item.label}</span>}
      {showLabel && item.badge !== undefined && (
        <span
          className="px-nav-label"
          style={{
            minWidth: 21, padding: "1px 6px", borderRadius: 999,
            background: item.badgeColor, color: "#0B1322",
            fontFamily: "var(--px-mono)", fontSize: "0.62rem", fontWeight: 700,
            textAlign: "center", lineHeight: 1.6,
          }}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
      {!showLabel && item.badge !== undefined && (
        <span
          aria-hidden
          style={{
            position: "absolute", top: 7, right: 9, width: 7, height: 7,
            borderRadius: 999, background: item.badgeColor,
            boxShadow: "0 0 0 2px var(--px-sidebar)",
          }}
        />
      )}
    </button>
  );
}

function NavList({ groups, activeTab, onSelect, showLabels }: {
  groups: NavGroup[]; activeTab: TabId; onSelect: (id: TabId) => void; showLabels: boolean;
}) {
  return (
    <>
      {groups.map((group) => (
        <div className="px-group" key={group.label}>
          <div className="px-group-label"><span>{group.label}</span></div>
          <nav className="flex flex-col gap-0.5 px-2" role="tablist" aria-label={group.label}>
            {group.items.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activeTab === item.id}
                showLabel={showLabels}
                onClick={() => onSelect(item.id)}
              />
            ))}
          </nav>
        </div>
      ))}
    </>
  );
}
function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="px-brand">
      <span className="px-brand-badge"><Shield size={18} /></span>
      {!collapsed && (
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div className="px-brand-name">PREDIX</div>
          <div className="px-brand-role">CENTRO DE MANDO ESTATAL</div>
        </div>
      )}
    </div>
  );
}

// Hoja "Más" (móvil) con fade inferior que solo aparece si hay más contenido.
function MoreSheet({ groups, activeTab, onSelect, onClose }: {
  groups: NavGroup[]; activeTab: TabId; onSelect: (id: TabId) => void; onClose: () => void;
}) {
  // Callback-ref vía useState → dispara el efecto cuando el nodo monta.
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const check = () => {
    if (!ref) return;
    setHasMore(ref.scrollTop + ref.clientHeight < ref.scrollHeight - 4);
  };
  useEffect(check, [ref]);

  return (
    <>
      <div className="px-sheet-bg" onClick={onClose} />
      <div className="px-sheet" role="dialog" aria-label="Todos los módulos">
        <div className="px-sheet-scroll" ref={setRef} onScroll={check}>
          <div className="px-sheet-handle" />
          <div className="flex items-center justify-between" style={{ paddingRight: 12 }}>
            <Brand collapsed={false} />
            <button onClick={onClose} aria-label="Cerrar" style={{ color: "var(--px-text-muted)" }}>
              <X size={18} />
            </button>
          </div>
          <div className="py-2">
            <NavList groups={groups} activeTab={activeTab} onSelect={onSelect} showLabels />
          </div>
          <SyncStatus />
        </div>
        <div className="px-sheet-fade" data-show={hasMore} aria-hidden />
      </div>
    </>
  );
}

function SyncStatus() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const hhmm = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="px-rail-sync">
      <span className="dot" />
      <span>Sincronizado · {hhmm}</span>
    </div>
  );
}

export default function SideNav({ activeTab, onTabChange, collapsed, onCollapsedChange, canToggle = true }: SideNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { modules, isLoading: modulesLoading } = useAccessibleModules();
  const badges = useNavBadges();
  const groups = useMemo(
    () => withRealBadges(groupsForModules(modulesLoading ? null : modules), badges),
    [modulesLoading, modules, badges.alertas, badges.incidentes]
  );

  // Cierra la hoja "Más" al cambiar de módulo.
  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  const primary = groups[0].items; // Operación: Tablero/Mapa/Alertas/Incidentes
  const moreActive = !primary.map((i) => i.id).includes(activeTab);

  // Rail (desktop/tablet) y bottom nav (móvil) SIEMPRE en el DOM.
  // CSS @media decide cuál se ve → nunca se desincroniza del ancho real.
  return (
    <>
      {/* ---------- Rail lateral (visible ≥768px) ---------- */}
      <aside className={`px-rail-aside px-rail flex flex-col${collapsed ? " is-collapsed" : ""}`}>
        <Brand collapsed={collapsed} />

        <ScrollFade className="flex-1">
          <div className="py-2">
            <NavList groups={groups} activeTab={activeTab} onSelect={onTabChange} showLabels={!collapsed} />
          </div>
        </ScrollFade>

        <SyncStatus />

        {canToggle && (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className="flex items-center gap-3 px-4"
            style={{
              height: 44, borderTop: "1px solid var(--px-hairline)",
              color: "var(--px-text-faint)", fontFamily: "var(--px-mono)", fontSize: "0.62rem",
              letterSpacing: "0.1em", justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>COLAPSAR</span>}
          </button>
        )}
      </aside>

      {/* ---------- Bottom nav (visible <768px) ---------- */}
      <nav className="px-botnav" role="tablist" aria-label="Módulos">
        {primary.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              data-active={active}
              onClick={() => onTabChange(item.id)}
              className="px-botnav-item"
            >
              <span className="px-botnav-ico">{item.icon}</span>
              <span>{item.label.split(" ")[0]}</span>
              {item.badge !== undefined && (
                <span className="px-botnav-dot" style={{ background: item.badgeColor }} aria-hidden />
              )}
            </button>
          );
        })}
        <button
          aria-label="Más módulos"
          data-active={moreActive}
          onClick={() => setMobileOpen(true)}
          className="px-botnav-item"
        >
          <span className="px-botnav-ico"><Menu size={20} /></span>
          <span>Más</span>
        </button>
      </nav>

      {/* ---------- Hoja "Más" (solo móvil) ---------- */}
      {mobileOpen && (
        <MoreSheet groups={groups} activeTab={activeTab} onSelect={onTabChange} onClose={() => setMobileOpen(false)} />
      )}
    </>
  );
}

export { COLLAPSE_KEY };
