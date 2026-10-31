// ============================================================
// useRealtimeEvents — Hook para consumir Server-Sent Events
// Reconexión automática, historial y filtrado por tipo
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";

export type EventType =
  | "nueva_alerta"
  | "alerta_actualizada"
  | "nuevo_incidente"
  | "incidente_actualizado"
  | "cambio_estado_integracion"
  | "secreto_expirado"
  | "elemento_posicion"
  | "kpi_actualizado"
  | "sistema";

export interface RealtimeEvent {
  id: string;
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
}

interface UseRealtimeEventsOptions {
  /** Tipos de eventos a escuchar (vacío = todos) */
  filterTypes?: EventType[];
  /** Máximo de eventos en historial */
  maxHistory?: number;
  /** Callback cuando llega un evento */
  onEvent?: (event: RealtimeEvent) => void;
  /** Habilitar/deshabilitar la conexión */
  enabled?: boolean;
}

interface UseRealtimeEventsReturn {
  /** Lista de eventos recibidos */
  events: RealtimeEvent[];
  /** Estado de la conexión */
  connected: boolean;
  /** Número de eventos no leídos */
  unreadCount: number;
  /** IDs de eventos no leídos (para estilar por item) */
  unreadIds: Set<string>;
  /** Marcar todos como leídos */
  markAllRead: () => void;
  /** Marcar un evento como leído */
  markRead: (eventId: string) => void;
  /** Limpiar historial */
  clearHistory: () => void;
  /** Último evento recibido */
  lastEvent: RealtimeEvent | null;
  /** Reconectar manualmente */
  reconnect: () => void;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}): UseRealtimeEventsReturn {
  const {
    filterTypes = [],
    maxHistory = 100,
    onEvent,
    enabled = true,
  } = options;

  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const filterTypesRef = useRef(filterTypes);

  // Mantener refs actualizadas
  onEventRef.current = onEvent;
  filterTypesRef.current = filterTypes;

  const connect = useCallback(() => {
    // Limpiar conexión anterior
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      console.log("[SSE] Conexión establecida");
    };

    es.onmessage = (e) => {
      try {
        const event: RealtimeEvent = JSON.parse(e.data);

        // Filtrar por tipo si se especificaron filtros
        const filters = filterTypesRef.current;
        if (filters.length > 0 && !filters.includes(event.type)) {
          return;
        }

        // No mostrar eventos de sistema como no leídos
        if (event.type !== "sistema") {
          setUnreadIds(prev => {
            const next = new Set(prev);
            next.add(event.id);
            return next;
          });
        }

        setLastEvent(event);
        setEvents(prev => {
          const updated = [...prev, event];
          return updated.length > maxHistory ? updated.slice(-maxHistory) : updated;
        });

        // Callback
        if (onEventRef.current) {
          onEventRef.current(event);
        }
      } catch (err) {
        console.error("[SSE] Error parsing event:", err);
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconexión automática con backoff
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("[SSE] Reconectando...");
        connect();
      }, 5000);
    };
  }, [maxHistory]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect]);

  const markAllRead = useCallback(() => {
    setUnreadIds(new Set());
  }, []);

  const markRead = useCallback((eventId: string) => {
    setUnreadIds(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setEvents([]);
    setUnreadIds(new Set());
    setLastEvent(null);
  }, []);

  return {
    events,
    connected,
    unreadCount: unreadIds.size,
    unreadIds,
    markAllRead,
    markRead,
    clearHistory,
    lastEvent,
    reconnect,
  };
}
