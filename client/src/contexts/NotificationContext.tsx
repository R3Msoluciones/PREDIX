// ============================================================
// NotificationContext — Estado global de notificaciones
// Provee eventos en tiempo real a todos los componentes
// ============================================================

import { createContext, useContext, type ReactNode } from "react";
import { useRealtimeEvents, type RealtimeEvent } from "@/hooks/useRealtimeEvents";

interface NotificationContextValue {
  events: RealtimeEvent[];
  connected: boolean;
  unreadCount: number;
  unreadIds: Set<string>;
  markAllRead: () => void;
  markRead: (eventId: string) => void;
  clearHistory: () => void;
  lastEvent: RealtimeEvent | null;
  reconnect: () => void;
  // Helpers filtrados
  alertEvents: RealtimeEvent[];
  incidentEvents: RealtimeEvent[];
  systemEvents: RealtimeEvent[];
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  // Sin toasts automáticos: los eventos en tiempo real solo alimentan el
  // historial y el badge de no-leídos (campana). Antes cada evento lanzaba un
  // toast (cada 8-20s), tapando las secciones. Los toasts manuales de acciones
  // de usuario (formularios, Integración, Alertas) siguen activos.
  const realtime = useRealtimeEvents({
    maxHistory: 200,
  });

  const alertEvents = realtime.events.filter(
    e => e.type === "nueva_alerta" || e.type === "alerta_actualizada"
  );

  const incidentEvents = realtime.events.filter(
    e => e.type === "nuevo_incidente" || e.type === "incidente_actualizado"
  );

  const systemEvents = realtime.events.filter(
    e => e.type === "sistema" || e.type === "cambio_estado_integracion" || e.type === "kpi_actualizado"
  );

  return (
    <NotificationContext.Provider
      value={{
        ...realtime,
        alertEvents,
        incidentEvents,
        systemEvents,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
