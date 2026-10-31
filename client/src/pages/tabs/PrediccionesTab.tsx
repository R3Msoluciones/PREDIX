// ============================================================
// PREDICCIONES — Modelo Predictivo ATENEA-ML (PREDIX v2)
// Desktop: panel config (izq) + resultados (der)
// Mobile: scroll vertical, municipio colapsable
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Brain, Activity, Loader, Download, RefreshCw, TrendingUp, TrendingDown, Minus, BarChart3, ChevronDown, ShieldCheck, ShieldAlert, AlertTriangle, Siren, ListChecks } from "lucide-react";
import PredictionChart from "@/components/PredictionChart";
import { toast } from "sonner";
import { OriginBadge } from "@/components/dashboard";
import { useIncidenciaSummary } from "@/hooks/useIncidenciaData";
import { TIPO_DELITO_LABELS } from "@/lib/delitoLabels";

// Los 4 niveles de riesgo comparten un solo significado en toda la app —
// mismo mapeo de color que ZonasTab.tsx (bajo=ok, medio=brand, alto=warn, crítico=crit).
function riskColor(r: string) {
  if (r === "crítico") return "var(--px-crit)";
  if (r === "alto") return "var(--px-warn)";
  if (r === "medio") return "var(--px-brand)";
  return "var(--px-ok)";
}

const RISK_INFO: Record<string, { label: string; meaning: string; Icon: typeof ShieldCheck }> = {
  bajo: { label: "Bajo", meaning: "Situación bajo control. Mantén la vigilancia habitual.", Icon: ShieldCheck },
  medio: { label: "Medio", meaning: "Atención moderada. Revisa los puntos de patrullaje más débiles.", Icon: ShieldAlert },
  alto: { label: "Alto", meaning: "Riesgo elevado. Refuerza la vigilancia y prepara respuesta rápida.", Icon: AlertTriangle },
  "crítico": { label: "Crítico", meaning: "Riesgo crítico. Actúa de inmediato: refuerzo total y coordinación interinstitucional.", Icon: Siren },
};

const TENDENCIA_INFO: Record<string, { label: string; Icon: typeof TrendingUp; color: string }> = {
  al_alza: { label: "Va en aumento", Icon: TrendingUp, color: "var(--px-crit)" },
  a_la_baja: { label: "Va en disminución", Icon: TrendingDown, color: "var(--px-ok)" },
  estable: { label: "Se mantiene estable", Icon: Minus, color: "var(--px-text-muted)" },
};

const CLASE_LABELS: Record<string, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  crítico: "Crítico",
};

export default function PrediccionesTab() {
  const [selectedMunicipio, setSelectedMunicipio] = useState("");
  const [meses, setMeses] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lockedMuni, setLockedMuni] = useState("");
  const [lockedMeses, setLockedMeses] = useState(3);
  const [generationKey, setGenerationKey] = useState(0);
  const [history, setHistory] = useState<Array<{ municipio: string; fecha: string; riesgo: string; delitos: number }>>([]);
  const [muniSearch, setMuniSearch] = useState("");
  const [muniListOpen, setMuniListOpen] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  const { data: summary } = useIncidenciaSummary();
  const { data: municipiosData, isLoading: loadingMunis } = trpc.predicciones.obtenerMunicipios.useQuery();
  const { data: metricasData } = trpc.predicciones.metricasClasificador.useQuery();
  const metricasClasificador = metricasData?.data || [];
  const municipios = municipiosData?.data || [];
  const filteredMunis = useMemo(() => muniSearch ? municipios.filter(m => m.toLowerCase().includes(muniSearch.toLowerCase())) : municipios, [municipios, muniSearch]);

  // Query usa parámetros "bloqueados" al momento de click, no los del select
  const { data: prediccionData, isLoading: loadingPred } = trpc.predicciones.analizarRiesgo.useQuery(
    { municipio: lockedMuni, meses: lockedMeses },
    { enabled: !!lockedMuni && generationKey > 0 }
  );

  useEffect(() => { if (municipios.length > 0 && !selectedMunicipio) setSelectedMunicipio(municipios[0]); }, [municipios, selectedMunicipio]);

  const pred = prediccionData?.data;

  useEffect(() => {
    if (pred && generationKey > 0) {
      setHistory(prev => {
        if (prev.find(p => p.municipio === pred.municipio && p.fecha === new Date().toLocaleTimeString())) return prev;
        return [...prev, { municipio: pred.municipio, fecha: new Date().toLocaleTimeString(), riesgo: pred.riesgoProyectado, delitos: pred.predicciones?.[0]?.prediccion || 0 }].slice(-10);
      });
      setIsGenerating(false);
    }
  }, [pred, generationKey]);

  const handleGenerar = () => {
    if (!selectedMunicipio) { toast.error("Selecciona un municipio"); return; }
    setIsGenerating(true);
    setLockedMuni(selectedMunicipio);
    setLockedMeses(meses);
    setGenerationKey(p => p + 1);
  };

  const handleExportCSV = () => {
    if (!pred) return;
    const rows = pred.predicciones.map((p: any) => [pred.municipio, p.mes || p.periodo, p.prediccion || 0, Math.round((p.prediccion || 0) * 0.85), Math.round((p.prediccion || 0) * 1.15), pred.tendenciaGeneral, pred.riesgoProyectado]);
    const csv = ["Municipio,Mes,Proyectado,Min,Max,Tendencia,Riesgo", ...rows.map((r: any[]) => r.join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `prediccion_${pred.municipio.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast.success(`Predicción exportada`);
  };

  const kpis = useMemo(() => {
    if (!pred) return null;
    const preds = pred.predicciones || [];
    const total = preds.reduce((s: number, p: any) => s + (p.prediccion || 0), 0);
    return { total, promedio: preds.length ? Math.round(total / preds.length) : 0, meses: preds.length, riesgo: pred.riesgoProyectado, tendencia: pred.tendenciaGeneral };
  }, [pred]);

  // Shared municipio selector + horizonte + generar
  const configJsx = (
    <>
      {/* Municipio — combobox con teclado (mismo patrón en mobile y desktop) */}
      <div style={{ padding: "var(--px-3) var(--px-4)", borderBottom: "1px solid var(--px-hairline)", position: "relative" }}>
        <div className="px-eyebrow" style={{ marginBottom: 4 }}>Municipio</div>
        <input type="text"
          placeholder={selectedMunicipio || "Escribir para buscar..."}
          value={muniSearch}
          onChange={e => { setMuniSearch(e.target.value); setMuniListOpen(true); }}
          onFocus={() => setMuniListOpen(true)}
          onBlur={() => setTimeout(() => setMuniListOpen(false), 200)}
          className="px-input"
          style={{ fontSize: "var(--px-text-xs)", color: muniSearch ? "var(--px-text)" : "var(--px-brand)", fontWeight: muniSearch ? 400 : 600, minHeight: 44, boxSizing: "border-box" }}
        />
        {/* Dropdown flotante */}
        {muniListOpen && filteredMunis.length > 0 && (
          <div className="scrollbar-tactical" style={{
            position: "absolute", left: "var(--px-4)", right: "var(--px-4)", zIndex: 20,
            marginTop: 4, maxHeight: 200, overflowY: "auto",
            background: "var(--px-bg)", border: "1px solid var(--px-hairline)",
            borderRadius: "var(--px-r-sm)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            {filteredMunis.slice(0, 30).map(m => (
              <div key={m} className="cursor-pointer transition-all"
                onMouseDown={e => { e.preventDefault(); setSelectedMunicipio(m); setMuniSearch(""); setMuniListOpen(false); }}
                style={{
                  minHeight: 44, boxSizing: "border-box", display: "flex", alignItems: "center",
                  padding: "0 var(--px-3)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)",
                  color: m === selectedMunicipio ? "var(--px-brand)" : "var(--px-text-muted)",
                  background: m === selectedMunicipio ? "color-mix(in srgb, var(--px-brand) 10%, transparent)" : "transparent",
                  fontWeight: m === selectedMunicipio ? 700 : 400,
                }}>
                {m}
              </div>
            ))}
            {filteredMunis.length > 30 && (
              <div style={{ padding: "6px var(--px-3)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", borderTop: "1px solid var(--px-hairline)" }}>
                +{filteredMunis.length - 30} más — escribe para filtrar
              </div>
            )}
          </div>
        )}
      </div>

      {/* Horizonte + generar */}
      <div style={{ padding: "var(--px-3) var(--px-4)", borderBottom: "1px solid var(--px-hairline)" }}>
        <div className="px-eyebrow" style={{ marginBottom: 4 }}>Horizonte</div>
        <div className="flex gap-1 mb-3">
          {[1, 3, 6, 12].map(m => (
            <button key={m} onClick={() => setMeses(m)} className="flex-1 px-hit44" style={{
              fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "6px 0",
              borderRadius: 4, border: "none", cursor: "pointer",
              background: meses === m ? "color-mix(in srgb, var(--px-brand) 15%, transparent)" : "transparent",
              color: meses === m ? "var(--px-brand)" : "var(--px-text-faint)",
              borderBottom: meses === m ? "2px solid var(--px-brand)" : "2px solid transparent",
            }}>
              {m}m
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleGenerar} disabled={isGenerating || loadingPred}
            className="px-btn px-btn-primary flex-1 px-hit44" style={{ minHeight: 40 }}>
            {isGenerating || loadingPred ? <><Loader size={14} className="animate-spin" /> Generando...</> : <><Brain size={14} /> Generar</>}
          </button>
          <button onClick={() => { setGenerationKey(0); setMeses(3); toast.info("Reiniciado"); }}
            className="px-btn px-btn-secondary px-hit44" style={{ minHeight: 40 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    </>
  );

  const historyJsx = history.length > 0 ? (
    <div style={{ padding: "var(--px-3) var(--px-4)" }}>
      <div className="px-eyebrow" style={{ marginBottom: "var(--px-2)" }}>Historial ({history.length})</div>
      {history.map((h, i) => {
        const c = riskColor(h.riesgo);
        return (
          <div key={i} className="flex items-center gap-2" style={{ padding: "var(--px-1) 0", borderBottom: "1px solid var(--px-hairline)" }}>
            <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", width: 48, flexShrink: 0 }}>{h.fecha}</span>
            <span className="truncate" style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)", flex: 1 }}>{h.municipio}</span>
            <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", fontWeight: 700, color: c }}>{h.riesgo.toUpperCase()}</span>
          </div>
        );
      })}
    </div>
  ) : (
    <div style={{ padding: "var(--px-4)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", textAlign: "center" }}>
      Las consultas aparecerán aquí
    </div>
  );

  const resultJsx = (
    <>
      {(isGenerating || loadingPred) && (
        <div className="flex items-center justify-center" style={{ padding: "var(--px-7)" }}>
          <div className="text-center">
            <Loader size={28} className="animate-spin mx-auto" style={{ color: "var(--px-brand)", marginBottom: "var(--px-3)" }} />
            <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)" }}>Procesando {selectedMunicipio}...</div>
          </div>
        </div>
      )}

      {pred && !loadingPred && !isGenerating && kpis && (() => {
        const risk = RISK_INFO[kpis.riesgo] ?? RISK_INFO.medio;
        const tendencia = TENDENCIA_INFO[kpis.tendencia] ?? TENDENCIA_INFO.estable;
        const RiskIcon = risk.Icon;
        const TrendIcon = tendencia.Icon;
        const color = riskColor(kpis.riesgo);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-3)" }}>

            {/* ── Estado del municipio — lo primero que se ve, sin jerga ── */}
            <div style={{
              padding: "var(--px-4)", borderRadius: "var(--px-r-md)",
              background: `color-mix(in srgb, ${color} 8%, var(--px-surface))`,
              border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
            }}>
              <div className="flex items-start gap-3">
                <div style={{
                  width: 52, height: 52, flexShrink: 0, borderRadius: 12,
                  background: `color-mix(in srgb, ${color} 16%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <RiskIcon size={26} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-xl)", fontWeight: 700, color, lineHeight: 1 }}>
                      Riesgo {risk.label}
                    </span>
                    <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>
                      · {pred.municipio}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                    {risk.meaning}
                  </p>
                  <div className="flex items-center gap-1" style={{ marginTop: 8, color: tendencia.color }}>
                    <TrendIcon size={13} />
                    <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", fontWeight: 600 }}>{tendencia.label}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Qué hacer — la razón de ser de esta pantalla ── */}
            {pred.recomendaciones?.length > 0 && (
              <div style={{ padding: "var(--px-3) var(--px-4)", borderRadius: "var(--px-r-sm)", border: "1px solid var(--px-hairline)" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: "var(--px-2)" }}>
                  <ListChecks size={13} style={{ color: "var(--px-brand)" }} />
                  <span className="px-eyebrow">Qué hacer</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {pred.recomendaciones.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginTop: 1 }}>{i + 1}.</span>
                      <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", color: "var(--px-text)", lineHeight: 1.4 }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Datos de apoyo, en lenguaje llano ── */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: "Promedio/mes", v: kpis.promedio.toLocaleString(), sub: "delitos estimados" },
                { l: "Próximo mes", v: (pred.predicciones?.[0]?.prediccion ?? 0).toLocaleString(), sub: "delitos estimados" },
                { l: "Periodo analizado", v: `${kpis.meses}m`, sub: "meses hacia adelante" },
              ].map((k, i) => (
                <div key={i} style={{ padding: "var(--px-2) var(--px-3)", border: "1px solid var(--px-hairline)", borderRadius: "var(--px-r-sm)" }}>
                  <div className="px-eyebrow" style={{ marginBottom: 2 }}>{k.l}</div>
                  <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-text)", lineHeight: 1 }}>{k.v}</div>
                  <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <PredictionChart predicciones={pred.predicciones} municipio={pred.municipio} tendencia={pred.tendenciaGeneral} riesgo={pred.riesgoProyectado} />

            {/* ── Cómo se calculó — oculto por default, en lenguaje llano cuando se abre ── */}
            <div style={{ border: "1px solid var(--px-hairline)", borderRadius: "var(--px-r-sm)", overflow: "hidden" }}>
              <button
                onClick={() => setShowTechnical((v) => !v)}
                aria-expanded={showTechnical}
                aria-controls="pred-technical-detail"
                className="w-full flex items-center justify-between"
                style={{ padding: "var(--px-2) var(--px-4)", minHeight: 44, boxSizing: "border-box", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
                  ¿Cómo se calculó esta predicción?
                </span>
                <ChevronDown size={14} style={{ color: "var(--px-text-faint)", transform: showTechnical ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {showTechnical && (
                <div id="pred-technical-detail" style={{ padding: "var(--px-3) var(--px-4)", borderTop: "1px solid var(--px-hairline)", display: "flex", flexDirection: "column", gap: "var(--px-4)" }}>

                  {pred.desglose?.length > 0 && (
                    <div>
                      <div className="px-eyebrow" style={{ marginBottom: 2 }}>Qué tipo de delito influye más</div>
                      <p style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginBottom: "var(--px-2)", lineHeight: 1.4 }}>
                        Cuántos delitos de cada tipo se esperan el próximo mes.
                      </p>
                      {pred.desglose.map((d: any) => (
                        <div key={d.tipo} className="flex items-center gap-2" style={{ padding: "6px 0", borderBottom: "1px solid var(--px-hairline)" }}>
                          <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)", flex: 1 }}>
                            {TIPO_DELITO_LABELS[d.tipo] || d.tipo}
                          </span>
                          <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", fontWeight: 700, color: "var(--px-brand)", width: 48, textAlign: "right" }}>
                            {d.promedioPredictivo}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {pred.riesgoClasificacion && (
                    <div>
                      <div className="px-eyebrow" style={{ marginBottom: 2 }}>Qué tan seguro está el sistema</div>
                      <p style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginBottom: "var(--px-2)", lineHeight: 1.4 }}>
                        De 100 municipios parecidos a este, así se reparte hacia dónde apunta el riesgo:
                      </p>
                      <div className="grid grid-cols-4 gap-2" style={{ marginBottom: "var(--px-3)" }}>
                        {(["bajo", "medio", "alto", "crítico"] as const).map((c) => (
                          <div key={c} style={{ padding: "6px", borderRadius: 4, textAlign: "center", background: c === pred.riesgoClasificacion!.clase ? "color-mix(in srgb, var(--px-brand) 12%, transparent)" : "transparent", border: c === pred.riesgoClasificacion!.clase ? "1px solid var(--px-brand)" : "1px solid var(--px-hairline)" }}>
                            <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{CLASE_LABELS[c]}</div>
                            <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", fontWeight: 700, color: c === pred.riesgoClasificacion!.clase ? "var(--px-brand)" : "var(--px-text-muted)" }}>
                              {pred.riesgoClasificacion!.probabilidades[c]}%
                            </div>
                          </div>
                        ))}
                      </div>
                      {(() => {
                        const ganador = metricasClasificador.find((m) => m.esGanador) ?? metricasClasificador[0];
                        if (!ganador) return null;
                        return (
                          <p style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)", lineHeight: 1.5, padding: "var(--px-2) var(--px-3)", background: "color-mix(in srgb, var(--px-brand) 5%, transparent)", borderRadius: "var(--px-r-sm)" }}>
                            Este sistema se puso a prueba contra 12 meses de información real que nunca había visto, y acertó el nivel de riesgo en <strong style={{ color: "var(--px-text)" }}>{ganador.accuracy} de cada 100 casos</strong>.
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {!pred && !loadingPred && !isGenerating && generationKey === 0 && (
        <div style={{ padding: "var(--px-4)" }}>
          {/* Hero — icono + headline */}
          <div className="text-center" style={{ marginBottom: "var(--px-5)" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto var(--px-3)", borderRadius: 12, background: "color-mix(in srgb, var(--px-brand) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--px-brand) 20%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={28} style={{ color: "var(--px-brand)" }} />
            </div>
            <div style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-text)", marginBottom: "var(--px-1)" }}>
              Modelo predictivo listo
            </div>
            <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-sm)", color: "var(--px-text-faint)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
              Selecciona un municipio y genera predicciones basadas en 10 años de datos SESNSP.
            </div>
          </div>

          {/* Stats — 3 cards horizontales */}
          <div className="grid grid-cols-2 gap-2" style={{ marginBottom: "var(--px-4)" }}>
            {[
              { v: "125", l: "Municipios", c: "var(--px-brand)", icon: <BarChart3 size={14} /> },
              { v: "10 años", l: "Histórico", c: "var(--px-text-muted)", icon: <Activity size={14} /> },
            ].map(s => (
              <div key={s.l} className="rounded-md text-center" style={{ padding: "var(--px-3)", background: "color-mix(in srgb, var(--px-brand) 4%, transparent)", border: "1px solid var(--px-hairline)" }}>
                <div style={{ color: s.c, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Flujo — pasos numerados (estructura = información) */}
          <div className="px-eyebrow" style={{ marginBottom: "var(--px-2)" }}>Cómo funciona</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { step: "1", title: "Municipio", desc: "Busca y selecciona el municipio a analizar" },
              { step: "2", title: "Horizonte", desc: "Elige 1, 3, 6 o 12 meses de proyección" },
              { step: "3", title: "Resultado", desc: "Riesgo, tendencia, gráfica y recomendaciones" },
            ].map(s => (
              <div key={s.step} className="flex gap-3" style={{ padding: "var(--px-3)", borderRadius: "var(--px-r-sm)", border: "1px solid var(--px-hairline)" }}>
                <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-brand)", lineHeight: 1, flexShrink: 0 }}>{s.step}</span>
                <div>
                  <div style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-sm)", fontWeight: 600, color: "var(--px-text)", marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--px-bg)", padding: "var(--px-3)", gap: "var(--px-3)" }}>

      {/* Toolbar */}
      <div className="px-card flex items-center gap-2 flex-wrap" style={{ padding: "var(--px-2) var(--px-4)", flexShrink: 0 }}>
        <Brain size={14} style={{ color: "var(--px-brand)" }} />
        <span style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-sm)", fontWeight: 700, color: "var(--px-text)" }}>ATENEA-ML</span>
        <OriginBadge real={summary.origen === "real"} />
        <div className="flex items-center gap-2 ml-auto">
          {pred && <button onClick={handleExportCSV} className="px-btn px-btn-secondary px-hit44" style={{ padding: "3px 8px", fontSize: "var(--px-text-xs)" }}><Download size={11} /> CSV</button>}
        </div>
      </div>

      {/* Desktop: 2 paneles / Mobile: scroll vertical */}
      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 gap-3" style={{ minHeight: 0 }}>
        <div className="px-card flex flex-col w-72 lg:w-80 shrink-0 overflow-hidden">
          {configJsx}
          <div className="flex-1 overflow-y-auto scrollbar-tactical">{historyJsx}</div>
        </div>
        <div className="px-card flex flex-col flex-1 overflow-y-auto scrollbar-tactical" style={{ padding: "var(--px-4)" }}>
          {resultJsx}
        </div>
      </div>

      {/* Mobile layout — scroll vertical */}
      <div className="md:hidden flex-1 overflow-y-auto scrollbar-tactical flex flex-col gap-3">
        <div className="px-card">{configJsx}</div>
        <div className="px-card" style={{ padding: "var(--px-3)" }}>{resultJsx}</div>
        {history.length > 0 && <div className="px-card">{historyJsx}</div>}
      </div>
    </div>
  );
}
