// ============================================================
// REALTIME SERVICE — Server-Sent Events para notificaciones
// Maneja conexiones SSE, emite eventos y simula datos en vivo
// ============================================================

import { EventEmitter } from "events";
import type { Request, Response } from "express";
import { logger } from "../_core/logger";

// ── Tipos de eventos ────────────────────────────────────────
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

// ── Event Bus global ────────────────────────────────────────
class RealtimeEventBus extends EventEmitter {
  private clients: Map<string, Response> = new Map();
  private eventHistory: RealtimeEvent[] = [];
  private maxHistory = 100;
  private simulatorInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  // Registrar un cliente SSE
  addClient(clientId: string, res: Response): void {
    this.clients.set(clientId, res);
    logger.info(`[SSE] Cliente conectado: ${clientId} (total: ${this.clients.size})`);

    // Enviar evento de conexión exitosa
    this.sendToClient(clientId, {
      id: `sys-${Date.now()}`,
      type: "sistema",
      timestamp: Date.now(),
      data: { connected: true, clientId },
      severity: "success",
      title: "Conexión Establecida",
      message: "Canal de tiempo real activo",
    });
  }

  // Remover un cliente SSE
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.info(`[SSE] Cliente desconectado: ${clientId} (total: ${this.clients.size})`);
  }

  // Enviar evento a un cliente específico
  private sendToClient(clientId: string, event: RealtimeEvent): void {
    const res = this.clients.get(clientId);
    if (res && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  // Broadcast evento a todos los clientes
  broadcast(event: RealtimeEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }

    this.emit("event", event);

    const entries = Array.from(this.clients.entries());
    for (const [cId, cRes] of entries) {
      if (!cRes.writableEnded) {
        cRes.write(`data: ${JSON.stringify(event)}\n\n`);
      } else {
        this.clients.delete(cId);
      }
    }
  }

  // Obtener historial de eventos
  getHistory(limit: number = 50): RealtimeEvent[] {
    return this.eventHistory.slice(-limit);
  }

  // Obtener número de clientes conectados
  getClientCount(): number {
    return this.clients.size;
  }

  // ── Simulador de eventos ────────────────────────────────
  startSimulator(): void {
    if (this.simulatorInterval) return;

    const municipios = [
      "Ecatepec", "Nezahualcóyotl", "Naucalpan", "Tlalnepantla",
      "Toluca", "Chimalhuacán", "Ixtapaluca", "Cuautitlán Izcalli",
      "Atizapán de Zaragoza", "Tultitlán", "Chalco", "Texcoco",
      "La Paz", "Huixquilucan", "Metepec"
    ];

    const tiposAlerta = [
      { tipo: "Robo a transeúnte", nivel: "warning" },
      { tipo: "Robo de vehículo", nivel: "warning" },
      { tipo: "Asalto a comercio", nivel: "warning" },
      { tipo: "Homicidio doloso", nivel: "critical" },
      { tipo: "Lesiones dolosas", nivel: "warning" },
      { tipo: "Violencia familiar", nivel: "warning" },
      { tipo: "Narcomenudeo", nivel: "critical" },
      { tipo: "Secuestro express", nivel: "critical" },
      { tipo: "Accidente vial", nivel: "info" },
      { tipo: "Llamada 911 verificada", nivel: "info" },
    ];

    const elementosPolicia = [
      { nombre: "Ofc. Pedro Martínez", id: "P-4521", lat: 19.601, lng: -99.053 },
      { nombre: "Ofc. Laura Jiménez", id: "P-3287", lat: 19.478, lng: -99.238 },
      { nombre: "Cap. Fernando Díaz", id: "ALFA-7", lat: 19.293, lng: -99.653 },
      { nombre: "Ofc. Ricardo Flores", id: "GPS-TLK-0891", lat: 19.282, lng: -99.655 },
      { nombre: "Cmdte. Alejandro Ruiz", id: "DELTA-3", lat: 19.358, lng: -98.985 },
    ];

    // Emitir eventos cada 8-20 segundos
    const emitRandomEvent = () => {
      const rand = Math.random();

      if (rand < 0.35) {
        // Nueva alerta
        const tipoAlerta = tiposAlerta[Math.floor(Math.random() * tiposAlerta.length)];
        const municipio = municipios[Math.floor(Math.random() * municipios.length)];
        this.broadcast({
          id: `alrt-${Date.now()}`,
          type: "nueva_alerta",
          timestamp: Date.now(),
          severity: tipoAlerta.nivel as "critical" | "warning" | "info",
          title: `Nueva Alerta: ${tipoAlerta.tipo}`,
          message: `${tipoAlerta.tipo} reportado en ${municipio}`,
          data: {
            tipo: tipoAlerta.tipo,
            nivel: tipoAlerta.nivel,
            municipio,
            lat: 19.2 + Math.random() * 0.5,
            lng: -99.9 + Math.random() * 0.9,
            unidades: Math.floor(Math.random() * 4) + 1,
          },
        });
      } else if (rand < 0.55) {
        // Nuevo incidente
        const tipoAlerta = tiposAlerta[Math.floor(Math.random() * tiposAlerta.length)];
        const municipio = municipios[Math.floor(Math.random() * municipios.length)];
        this.broadcast({
          id: `inc-${Date.now()}`,
          type: "nuevo_incidente",
          timestamp: Date.now(),
          severity: tipoAlerta.nivel === "critical" ? "critical" : "info",
          title: `Nuevo Incidente: ${tipoAlerta.tipo}`,
          message: `Incidente registrado en ${municipio} — ${tipoAlerta.tipo}`,
          data: {
            tipo: tipoAlerta.tipo,
            municipio,
            victimas: Math.floor(Math.random() * 3),
            estado: "en_investigacion",
          },
        });
      } else if (rand < 0.7) {
        // Actualización de posición de elemento policial
        const elem = elementosPolicia[Math.floor(Math.random() * elementosPolicia.length)];
        const newLat = elem.lat + (Math.random() - 0.5) * 0.01;
        const newLng = elem.lng + (Math.random() - 0.5) * 0.01;
        this.broadcast({
          id: `pos-${Date.now()}`,
          type: "elemento_posicion",
          timestamp: Date.now(),
          severity: "info",
          title: `Posición Actualizada`,
          message: `${elem.nombre} (${elem.id}) — Nueva posición registrada`,
          data: {
            elementoId: elem.id,
            nombre: elem.nombre,
            lat: newLat,
            lng: newLng,
            velocidad: Math.floor(Math.random() * 60),
          },
        });
      } else if (rand < 0.82) {
        // Alerta actualizada (cambio de estado)
        const estados = ["reconocida", "escalada", "en_proceso", "resuelta"];
        const estado = estados[Math.floor(Math.random() * estados.length)];
        this.broadcast({
          id: `upd-${Date.now()}`,
          type: "alerta_actualizada",
          timestamp: Date.now(),
          severity: estado === "resuelta" ? "success" : "info",
          title: `Alerta Actualizada`,
          message: `Alerta cambió a estado: ${estado.toUpperCase()}`,
          data: { nuevoEstado: estado },
        });
      } else if (rand < 0.92) {
        // KPI actualizado
        const kpis = [
          { nombre: "Incidentes Hoy", valor: Math.floor(Math.random() * 50) + 20 },
          { nombre: "Unidades Activas", valor: Math.floor(Math.random() * 100) + 200 },
          { nombre: "Llamadas 911", valor: Math.floor(Math.random() * 200) + 100 },
          { nombre: "Tiempo Respuesta", valor: `${Math.floor(Math.random() * 10) + 5} min` },
        ];
        const kpi = kpis[Math.floor(Math.random() * kpis.length)];
        this.broadcast({
          id: `kpi-${Date.now()}`,
          type: "kpi_actualizado",
          timestamp: Date.now(),
          severity: "info",
          title: `KPI Actualizado`,
          message: `${kpi.nombre}: ${kpi.valor}`,
          data: kpi,
        });
      } else {
        // Cambio de estado de integración
        const integraciones = ["SESNSP", "C5 EdoMéx", "INEGI", "SSEM - 911", "PGJ EdoMéx"];
        const integ = integraciones[Math.floor(Math.random() * integraciones.length)];
        const ok = Math.random() > 0.2;
        this.broadcast({
          id: `integ-${Date.now()}`,
          type: "cambio_estado_integracion",
          timestamp: Date.now(),
          severity: ok ? "success" : "warning",
          title: `Integración ${integ}`,
          message: ok ? `Sincronización completada exitosamente` : `Error de conexión — reintentando`,
          data: { integracion: integ, estado: ok ? "activo" : "error" },
        });
      }
    };

    // Emitir primer evento rápidamente
    setTimeout(() => emitRandomEvent(), 3000);

    // Luego cada 8-20 segundos
    this.simulatorInterval = setInterval(() => {
      emitRandomEvent();
    }, Math.floor(Math.random() * 12000) + 8000);

    logger.info("[SSE] Simulador de eventos iniciado");
  }

  stopSimulator(): void {
    if (this.simulatorInterval) {
      clearInterval(this.simulatorInterval);
      this.simulatorInterval = null;
      logger.info("[SSE] Simulador de eventos detenido");
    }
  }
}

// ── Singleton ───────────────────────────────────────────────
export const eventBus = new RealtimeEventBus();

// ── Express SSE handler ─────────────────────────────────────
export function sseHandler(req: Request, res: Response): void {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Configurar headers SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });

  // Flush headers
  res.flushHeaders();

  // Enviar comentario para mantener la conexión
  res.write(":ok\n\n");

  // Registrar cliente
  eventBus.addClient(clientId, res);

  // Heartbeat cada 30 segundos
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`:heartbeat ${Date.now()}\n\n`);
    }
  }, 30000);

  // Cleanup al desconectar
  req.on("close", () => {
    clearInterval(heartbeat);
    eventBus.removeClient(clientId);
  });
}

// ── API para emitir eventos manualmente ─────────────────────
export function emitEvent(event: Omit<RealtimeEvent, "id" | "timestamp">): void {
  eventBus.broadcast({
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  });
}
