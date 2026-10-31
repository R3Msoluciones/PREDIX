// ============================================================
// NAV CONFIG — Fuente ÚNICA de verdad de la navegación PREDIX.
// TabId + módulos agrupados + badges viven aquí (no duplicar).
// Consumido por SideNav (rail + bottom nav) y Home (tipo TabId).
// ============================================================

import {
  Map, Bell, AlertTriangle, TrendingUp, LayoutDashboard, Target,
  MessageSquare, Plug, ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";

export type TabId =
  | "mapa" | "alertas" | "incidentes" | "predicciones"
  | "tablero" | "zonas" | "chatbot" | "integracion" | "admin";

export interface NavItem {
  id: TabId;
  label: string;
  icon: ReactNode;
  badge?: number;
  badgeColor?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /**
   * Módulo RBAC real (server/_core/infra/permissions.ts → MODULES) que debe
   * tener canView=1 (vía auth.getAccessibleModules) para ver el grupo. Ausente
   * = visible para cualquier sesión real. "Integraciones" no tiene módulo
   * propio en el schema — comparte el gate de "admin" porque siempre vivió
   * exclusivamente dentro de "Sistema".
   */
  requireModule?: string;
}

// Los badges de "Alertas"/"Incidentes" NO viven aquí — se calculan en tiempo
// real en SideNav (useNavBadges, alertas no resueltas / incidentes abiertos)
// y se inyectan sobre estos items al renderizar.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { id: "tablero", label: "Tablero", icon: <LayoutDashboard size={18} /> },
      { id: "mapa", label: "Mapa Geoespacial", icon: <Map size={18} /> },
      { id: "alertas", label: "Alertas", icon: <Bell size={18} /> },
      { id: "incidentes", label: "Incidentes", icon: <AlertTriangle size={18} /> },
    ],
  },
  {
    label: "Inteligencia",
    items: [
      { id: "predicciones", label: "Modelo Predictivo", icon: <TrendingUp size={18} /> },
      { id: "zonas", label: "Mapa de Calor", icon: <Target size={18} /> },
      { id: "chatbot", label: "Asistente IA", icon: <MessageSquare size={18} /> },
    ],
  },
  {
    label: "Sistema",
    requireModule: "admin",
    items: [
      { id: "integracion", label: "Integraciones", icon: <Plug size={18} /> },
      { id: "admin", label: "Administración", icon: <ShieldCheck size={18} /> },
    ],
  },
];

// Lista plana de ids válidos (deep-links, validación).
export const TAB_IDS: TabId[] = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

/**
 * Grupos visibles según los módulos RBAC reales accesibles al usuario
 * (auth.getAccessibleModules). `modules === null` = todavía no se sabe
 * (sesión cargando) → se ocultan los grupos restringidos por defecto.
 */
export function groupsForModules(modules: string[] | null): NavGroup[] {
  return NAV_GROUPS.filter((g) => !g.requireModule || (modules?.includes(g.requireModule) ?? false));
}

/** ¿La sesión puede acceder a este tab? */
export function canAccessTab(modules: string[] | null, tab: TabId): boolean {
  return groupsForModules(modules).some((g) => g.items.some((i) => i.id === tab));
}
