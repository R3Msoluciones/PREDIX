/**
 * AlertsPanel — Panel emergente de alertas
 * Muestra todas las alertas activas con detalles
 */

import { X, AlertCircle, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Alert {
  id: string;
  titulo: string;
  descripcion: string;
  nivel: "info" | "warning" | "critical";
  municipio: string;
  hora: string;
  estado: "activa" | "resuelta" | "en_proceso";
}

interface AlertsPanelProps {
  alerts: Alert[];
  onClose: () => void;
  onAlertClick?: (alert: Alert) => void;
}

export default function AlertsPanel({ alerts, onClose, onAlertClick }: AlertsPanelProps) {
  const getAlertIcon = (nivel: string) => {
    switch (nivel) {
      case "critical":
        return <AlertOctagon size={16} className="text-red-500" />;
      case "warning":
        return <AlertTriangle size={16} className="text-yellow-500" />;
      default:
        return <AlertCircle size={16} className="text-blue-500" />;
    }
  };

  const getAlertBgColor = (nivel: string) => {
    switch (nivel) {
      case "critical":
        return "bg-red-950/30 border-red-500/30";
      case "warning":
        return "bg-yellow-950/30 border-yellow-500/30";
      default:
        return "bg-blue-950/30 border-blue-500/30";
    }
  };

  const getStatusBadgeColor = (estado: string) => {
    switch (estado) {
      case "activa":
        return "bg-red-500/20 text-red-300";
      case "en_proceso":
        return "bg-yellow-500/20 text-yellow-300";
      default:
        return "bg-green-500/20 text-green-300";
    }
  };

  return (
    <div
      className="absolute top-16 right-4 w-96 max-h-96 rounded-lg shadow-2xl overflow-hidden z-50"
      style={{
        background: "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(20,30,48,0.95) 100%)",
        border: "1px solid rgba(0,212,255,0.2)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}
      >
        <h3 className="text-sm font-semibold text-cyan-400" style={{ fontFamily: "Rajdhani, sans-serif" }}>
          ALERTAS ACTIVAS ({alerts.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Alerts list */}
      <div className="overflow-y-auto max-h-80 scrollbar-tactical">
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Info size={16} className="mr-2" />
            <span className="text-sm">Sin alertas activas</span>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => onAlertClick?.(alert)}
                className={`w-full text-left p-3 rounded border transition-all hover:border-opacity-100 ${getAlertBgColor(
                  alert.nivel
                )}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getAlertIcon(alert.nivel)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-xs font-semibold text-gray-100 truncate">
                        {alert.titulo}
                      </h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${getStatusBadgeColor(
                          alert.estado
                        )}`}
                        style={{ fontFamily: "IBM Plex Mono, monospace" }}
                      >
                        {alert.estado === "activa" ? "ACTIVA" : alert.estado === "en_proceso" ? "EN PROCESO" : "RESUELTA"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mb-2 line-clamp-2">
                      {alert.descripcion}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{alert.municipio}</span>
                      <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {alert.hora}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div
          className="px-4 py-2 flex gap-2"
          style={{ borderTop: "1px solid rgba(0,212,255,0.1)" }}
        >
          <Button
            size="sm"
            className="flex-1 text-xs h-7"
            style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF" }}
          >
            Ver Todas
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7 bg-green-600/20 hover:bg-green-600/30 text-green-300"
          >
            Marcar Leídas
          </Button>
        </div>
      )}
    </div>
  );
}
