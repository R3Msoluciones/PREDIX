/**
 * IncidentDetailModal — Detalle completo de incidente (PREDIX v2)
 * Narrativa como héroe, metadata en grid compacto, tabs detalles/archivos
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Clock, User, Shield, FileText, CheckCircle, AlertCircle, Loader } from "lucide-react";
import AttachmentUploader from "./AttachmentUploader";
import AttachmentList from "./AttachmentList";

interface Incident {
  id: string;
  tipo: string;
  municipio: string;
  colonia: string;
  hora: string;
  fecha: string;
  estado: string;
  prioridad: string;
  lat: number;
  lng: number;
  narrativa: string;
  personal: string;
  atendido: boolean;
}

interface Props {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
}

const priColor = (p: string) => ({
  "crítica": "var(--px-crit)", "alta": "var(--px-warn)", "media": "var(--px-brand)", "baja": "var(--px-ok)",
}[p] ?? "var(--px-text-muted)");

const estColor = (e: string) => ({
  "Cerrado": "var(--px-ok)", "En proceso": "var(--px-warn)", "Investigación": "var(--px-brand)",
}[e] ?? "var(--px-text-muted)");

const estIcon = (e: string) => ({
  "Cerrado": <CheckCircle size={14} />, "En proceso": <Loader size={14} className="animate-spin" />, "Investigación": <AlertCircle size={14} />,
}[e] ?? <AlertCircle size={14} />);

export default function IncidentDetailModal({ incident, isOpen, onClose }: Props) {
  const [tab, setTab] = useState<"details" | "attachments">("details");

  if (!incident) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent style={{ background: "var(--px-surface)", borderColor: "var(--px-hairline)" }}>
          <DialogHeader><DialogTitle style={{ color: "var(--px-text)" }}>Sin datos</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const pc = priColor(incident.prioridad);
  const ec = estColor(incident.estado);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[calc(100%-24px)] md:w-full max-h-[92vh] overflow-y-auto scrollbar-tactical" style={{ background: "var(--px-surface)", borderColor: "var(--px-hairline)", padding: 0 }}>

        {/* Header con gradient de severidad */}
        <div className="relative" style={{ padding: "var(--px-4)", paddingBottom: "var(--px-3)" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${pc}, transparent 70%)` }} />
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{incident.id}</span>
              <span className="px-delta" style={{ color: pc, background: `color-mix(in srgb, ${pc} 15%, transparent)`, textTransform: "uppercase" }}>{incident.prioridad}</span>
              <span className="px-delta flex items-center gap-1" style={{ color: ec, background: `color-mix(in srgb, ${ec} 12%, transparent)` }}>
                {estIcon(incident.estado)} {incident.estado}
              </span>
            </div>
            <DialogTitle style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-text)", lineHeight: 1.2 }}>
              {incident.tipo}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <div className="flex gap-0" style={{ borderBottom: "1px solid var(--px-hairline)" }}>
          {[
            { id: "details" as const, label: "Detalles", icon: <AlertCircle size={13} /> },
            { id: "attachments" as const, label: "Archivos", icon: <FileText size={13} /> },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex items-center justify-center gap-1.5" style={{
              fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "var(--px-3) var(--px-4)", minHeight: 44,
              color: tab === t.id ? "var(--px-brand)" : "var(--px-text-faint)",
              borderBottom: tab === t.id ? "2px solid var(--px-brand)" : "2px solid transparent",
              background: "none", borderTop: "none", borderLeft: "none", borderRight: "none", cursor: "pointer",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "var(--px-3) var(--px-4)" }}>
          {tab === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-4)" }}>

              {/* Narrativa — héroe del modal */}
              <div>
                <div className="px-eyebrow" style={{ marginBottom: "var(--px-2)" }}>Narrativa de hechos</div>
                <p style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", color: "var(--px-text)", lineHeight: 1.7 }}>
                  {incident.narrativa}
                </p>
              </div>

              {/* Metadata grid compacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-md overflow-hidden" style={{ border: "1px solid var(--px-hairline)" }}>
                {[
                  { icon: <MapPin size={13} />, label: "Municipio", value: incident.municipio, color: "var(--px-brand)" },
                  { icon: <MapPin size={13} />, label: "Colonia", value: incident.colonia, color: "var(--px-brand)" },
                  { icon: <Clock size={13} />, label: "Hora", value: incident.hora, color: "var(--px-text-muted)" },
                  { icon: <Clock size={13} />, label: "Fecha", value: incident.fecha, color: "var(--px-text-muted)" },
                  { icon: <User size={13} />, label: "Personal", value: incident.personal, color: "var(--px-text)" },
                  { icon: <Shield size={13} />, label: "Coords", value: `${incident.lat.toFixed(4)}°N, ${Math.abs(incident.lng).toFixed(4)}°W`, color: "var(--px-text-faint)" },
                ].map(item => (
                  <div key={item.label} style={{ padding: "var(--px-3)", background: "var(--px-bg)" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{ color: "var(--px-text-faint)" }}>{item.icon}</span>
                      <span className="px-eyebrow">{item.label}</span>
                    </div>
                    <div className="truncate" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: item.color, fontWeight: 500 }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Estatus de atención */}
              <div className="px-card" style={{ padding: "var(--px-3)" }}>
                <div className="px-eyebrow" style={{ marginBottom: "var(--px-2)" }}>Estatus de atención</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-2)" }}>
                  {[
                    { label: "Reportado", ok: true },
                    { label: "Unidades desplegadas", ok: true },
                    { label: "Atendido", ok: incident.atendido },
                    { label: "Estado actual", value: incident.estado },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between" style={{ padding: "var(--px-1) 0", borderBottom: "1px solid var(--px-hairline)" }}>
                      <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)" }}>{row.label}</span>
                      {row.value ? (
                        <span className="px-delta" style={{ color: ec, background: `color-mix(in srgb, ${ec} 12%, transparent)` }}>{row.value}</span>
                      ) : (
                        <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: row.ok ? "var(--px-ok)" : "var(--px-warn)", fontWeight: 600 }}>
                          {row.ok ? "✓ Sí" : "⏳ En proceso"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timestamp */}
              <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", textAlign: "right" }}>
                Actualizado: {incident.fecha} · {incident.hora}
              </div>
            </div>
          )}

          {tab === "attachments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-4)" }}>
              <div className="px-card" style={{ padding: "var(--px-4)" }}>
                <div className="px-eyebrow" style={{ marginBottom: "var(--px-3)" }}>Cargar archivos</div>
                <AttachmentUploader incidentId={incident.id} onUploadSuccess={() => {}} />
              </div>
              <div className="px-card" style={{ padding: "var(--px-4)" }}>
                <AttachmentList incidentId={incident.id} onRefresh={() => {}} />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
