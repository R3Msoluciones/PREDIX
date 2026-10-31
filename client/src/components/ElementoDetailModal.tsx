// ============================================================
// ELEMENTO DETAIL MODAL — Detalle de un elemento en campo.
// Mismo lenguaje que el detalle de Alertas (header + metadata grid +
// acciones). Modal centrado con tokens --px-*; cierra al tocar fuera.
// ============================================================

import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Shield, Navigation, Radio, MapPin, Building2, Clock, Crosshair, Phone, History } from "lucide-react";
import type { PoliceElement } from "@/data/policeData";

const TIPO_LABEL: Record<PoliceElement["identification"]["type"], string> = {
  patrulla: "Patrulla",
  grupo_operativo: "Grupo operativo",
  gps: "GPS",
  red_celular: "Red celular",
};

interface Props {
  element: PoliceElement | null;
  onClose: () => void;
  onCentrar: (el: PoliceElement) => void;
}

export default function ElementoDetailModal({ element, onClose, onCentrar }: Props) {
  if (!element) return null;
  const isCmd = element.role === "Comandante";
  const color = isCmd ? "#AB47BC" : "#4FC3F7";
  const id = element.identification;

  const meta: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "IDENTIFICACIÓN", value: id.value, icon: <Shield size={12} /> },
    { label: "TIPO DE RASTREO", value: TIPO_LABEL[id.type], icon: id.type === "patrulla" ? <Navigation size={12} /> : <Radio size={12} /> },
    { label: "DEPARTAMENTO / SECTOR", value: element.department, icon: <Building2 size={12} /> },
    { label: "ÚLTIMA ACTUALIZACIÓN", value: id.lastUpdate, icon: <Clock size={12} /> },
    { label: "COORDENADAS", value: `${id.lat.toFixed(4)}° N, ${Math.abs(id.lng).toFixed(4)}° W`, icon: <MapPin size={12} /> },
    { label: "ESTADO", value: element.status === "active" ? "EN LÍNEA" : element.status.toUpperCase(), icon: <Radio size={12} /> },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(3,8,16,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: "var(--px-surface-2)", border: "1px solid var(--px-hairline-strong)", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Detalle de ${element.name}`}
      >
        {/* Header */}
        <div className="p-5" style={{ background: `${color}14`, borderBottom: `1px solid ${color}40`, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22`, border: `1px solid ${color}50`, color }}>
              {isCmd ? <Shield size={22} /> : <Navigation size={22} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span style={{ fontFamily: "var(--px-mono)", fontSize: "0.62rem", letterSpacing: "0.1em", color }}>{element.role.toUpperCase()}</span>
                <span className="px-2 py-0.5 rounded-sm" style={{ fontFamily: "var(--px-mono)", fontSize: "0.62rem", background: "rgba(61,163,93,0.15)", border: "1px solid rgba(61,163,93,0.35)", color: "var(--px-ok)" }}>
                  ● EN LÍNEA
                </span>
                <span className="px-2 py-0.5 rounded-sm" style={{ fontFamily: "var(--px-mono)", fontSize: "0.62rem", background: "rgba(229,162,61,0.15)", border: "1px solid rgba(229,162,61,0.35)", color: "var(--px-warn)" }} title="Simulación de despliegue táctico — no rastrea personal real">
                  DEMO
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--px-display)", fontSize: "1.3rem", fontWeight: 700, color: "var(--px-text)", lineHeight: 1.2 }}>
                {element.name}
              </h2>
              <div style={{ fontFamily: "var(--px-mono)", fontSize: "0.7rem", color: "var(--px-text-muted)", marginTop: 2 }}>{id.value}</div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="shrink-0" style={{ color: "var(--px-text-faint)" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {meta.map((m) => (
            <div key={m.label} className="p-3 rounded" style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)" }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: "var(--px-text-faint)" }}>
                {m.icon}
                <span style={{ fontFamily: "var(--px-mono)", fontSize: "0.62rem", letterSpacing: "0.1em" }}>{m.label}</span>
              </div>
              <div style={{ fontFamily: "var(--px-mono)", fontSize: "0.76rem", color: "var(--px-brand)" }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-5">
          <button
            onClick={() => { onCentrar(element); onClose(); }}
            className="flex items-center justify-center gap-2 py-2.5 rounded transition-colors"
            style={{ background: "var(--px-brand-soft)", border: "1px solid rgba(0,212,255,0.3)", color: "var(--px-brand)", fontFamily: "var(--px-mono)", fontSize: "0.64rem", letterSpacing: "0.06em", cursor: "pointer" }}
          >
            <Crosshair size={14} /> CENTRAR
          </button>
          <button
            onClick={() => toast.success(`Solicitud de contacto enviada a ${element.name}`)}
            className="flex items-center justify-center gap-2 py-2.5 rounded transition-colors"
            style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline-strong)", color: "var(--px-text)", fontFamily: "var(--px-mono)", fontSize: "0.64rem", letterSpacing: "0.06em", cursor: "pointer" }}
          >
            <Phone size={14} /> CONTACTAR
          </button>
          <button
            onClick={() => toast.info("Historial de movimientos disponible con datos reales (Fase 3).")}
            className="flex items-center justify-center gap-2 py-2.5 rounded transition-colors"
            style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline-strong)", color: "var(--px-text)", fontFamily: "var(--px-mono)", fontSize: "0.64rem", letterSpacing: "0.06em", cursor: "pointer" }}
          >
            <History size={14} /> HISTORIAL
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
