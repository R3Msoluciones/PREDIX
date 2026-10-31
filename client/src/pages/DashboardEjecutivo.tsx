/**
 * DashboardEjecutivo — Panel de control ejecutivo (PREDIX v2)
 * KPIs, tendencias, distribución de delitos, municipios críticos
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Users, AlertCircle, MapPin } from "lucide-react";
import ReportExporter from "@/components/ReportExporter";
import { KpiCard, TrendBadge, ModuleHeader, EmptyState } from "@/components/dashboard";
import { useCounter } from "@/hooks/useCounter";

const CRIME_COLORS: Record<string, string> = {
  homicidios: "var(--px-crit)",
  robos: "var(--px-warn)",
  lesiones: "#EAB308",
  violenciaSexual: "#EC4899",
  traficoDeDropas: "#8B5CF6",
  otrosDelitos: "var(--px-brand)",
};

function riskColor(riesgo: string) {
  if (riesgo === "CRÍTICO") return "var(--px-crit)";
  if (riesgo === "ALTO") return "var(--px-warn)";
  if (riesgo === "MEDIO") return "var(--px-brand)";
  return "var(--px-ok)";
}

export default function DashboardEjecutivo() {
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [activeSection, setActiveSection] = useState<"tendencias" | "delitos" | "municipios" | "comparativa">("tendencias");

  const { data: executiveSummary, isLoading: summaryLoading } = trpc.dashboard.getExecutiveSummary.useQuery();
  const { data: monthComparison } = trpc.dashboard.getMonthComparison.useQuery();
  const { data: crimeStats } = trpc.dashboard.getCrimeTypeStats.useQuery();

  const kpis = executiveSummary?.data?.kpis;
  const tendencyData = executiveSummary?.data?.tendencyData || [];
  const criticalMunicipalities = executiveSummary?.data?.criticalMunicipalities || [];

  const chartData = useMemo(() => {
    return tendencyData.map((d: any) => ({
      name: `${d.mes}/${d.anio}`,
      delitos: d.delitos,
      victimas: d.victimas,
      homicidios: d.homicidios,
    }));
  }, [tendencyData]);

  const crimeTypeData = useMemo(() => {
    if (!crimeStats?.data) return [];
    const stats = crimeStats.data;
    return [
      { name: "Homicidios", value: stats.homicidios, fill: "#E5484D" },
      { name: "Robos", value: stats.robos, fill: "#E5A23D" },
      { name: "Lesiones", value: stats.lesiones, fill: "#EAB308" },
      { name: "Violencia Sexual", value: stats.violenciaSexual, fill: "#EC4899" },
      { name: "Tráfico de Drogas", value: stats.traficoDeDropas, fill: "#8B5CF6" },
      { name: "Otros", value: stats.otrosDelitos, fill: "#00D4FF" },
    ];
  }, [crimeStats]);

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState text="Cargando dashboard ejecutivo..." />
      </div>
    );
  }

  const sections = [
    { key: "tendencias", label: "Tendencias" },
    { key: "delitos", label: "Tipos de Delitos" },
    { key: "municipios", label: "Municipios Críticos" },
    { key: "comparativa", label: "Comparativa Mensual" },
  ] as const;

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-tactical">
      <div className="dash-wrap px-stagger">
        {/* Header */}
        <div className="dash-toolbar">
          <div>
            <div className="px-eyebrow" style={{ marginBottom: 6 }}>Panel Ejecutivo · Estado de México</div>
            <h1 style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-xl)", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1, color: "var(--px-text)" }}>
              Seguridad Pública
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>
              Datos SESNSP · {new Date().toLocaleDateString("es-MX")}
            </span>
            <ReportExporter />
          </div>
        </div>

        {/* Alert for critical municipalities */}
        {kpis && kpis.municipiosCriticos > 0 && (
          <div className="px-card flex items-start gap-3" style={{ padding: "var(--px-4)", borderColor: "color-mix(in srgb, var(--px-crit) 30%, transparent)" }}>
            <AlertTriangle className="shrink-0 mt-0.5" style={{ width: 18, height: 18, color: "var(--px-crit)" }} />
            <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", color: "var(--px-text-muted)" }}>
              <strong style={{ color: "var(--px-crit)" }}>{kpis.municipiosCriticos} municipios en nivel CRÍTICO</strong> requieren atención inmediata.{" "}
              {kpis.municipiosAltos} municipios adicionales en nivel ALTO.
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="dash-kpis">
          <ExecKpi label="Total Incidentes" value={kpis?.totalIncidentes || 0} icon={<AlertCircle size={18} />} color="var(--px-crit)" trend={monthComparison?.data?.porcentajeDelitos} />
          <ExecKpi label="Total Víctimas" value={kpis?.totalVictimas || 0} icon={<Users size={18} />} color="var(--px-warn)" trend={monthComparison?.data?.porcentajeVictimas} />
          <ExecKpi label="Homicidios" value={kpis?.homicidios || 0} icon={<AlertTriangle size={18} />} color="var(--px-crit)" />
          <ExecKpi label="Robos" value={kpis?.robos || 0} icon={<MapPin size={18} />} color="var(--px-warn)" />
        </div>

        {/* Section switcher */}
        <div className="inline-flex" style={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)", borderRadius: 10, padding: 3 }}>
          {sections.map((s) => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              style={{
                fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.04em",
                color: activeSection === s.key ? "var(--px-text)" : "var(--px-text-muted)",
                background: activeSection === s.key ? "var(--px-brand-soft)" : "transparent",
                boxShadow: activeSection === s.key ? "inset 0 0 0 1px rgba(0,212,255,0.2)" : "none",
                border: "none", padding: "7px 14px", borderRadius: 7, cursor: "pointer", transition: "0.15s",
              }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Tendencias */}
        {activeSection === "tendencias" && (
          <div className="px-card" style={{ padding: "var(--px-5)" }}>
            <ModuleHeader title="TENDENCIA DE INCIDENCIA DELICTIVA" eyebrow="Últimos 12 meses · Delitos y Víctimas" />
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--px-text-faint)", fontSize: 10, fontFamily: "var(--px-mono)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--px-text-faint)", fontSize: 10, fontFamily: "var(--px-mono)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)", borderRadius: "var(--px-r-sm)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text)" }} />
                  <Legend wrapperStyle={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)" }} />
                  <Line type="monotone" dataKey="delitos" stroke="#E5484D" name="Delitos" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="victimas" stroke="#E5A23D" name="Víctimas" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Sin datos de tendencia" />}
          </div>
        )}

        {/* Tipos de Delitos */}
        {activeSection === "delitos" && (
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "var(--px-4)" }}>
            <div className="px-card" style={{ padding: "var(--px-5)" }}>
              <ModuleHeader title="DISTRIBUCIÓN POR TIPO" eyebrow="Porcentaje de cada tipo de delito" />
              {crimeTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={crimeTypeData} cx="50%" cy="50%" labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                      {crimeTypeData.map((entry: any, index: number) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--px-surface)", border: "1px solid var(--px-hairline)", borderRadius: "var(--px-r-sm)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text)" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState text="Sin datos de delitos" />}
            </div>

            <div className="px-card" style={{ padding: "var(--px-5)" }}>
              <ModuleHeader title="ESTADÍSTICAS POR TIPO" eyebrow="Mes actual" />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {crimeTypeData.map((crime: any, i: number) => (
                  <div key={crime.name} className="flex items-center justify-between"
                    style={{ padding: "10px 0", borderBottom: i < crimeTypeData.length - 1 ? "1px solid var(--px-hairline)" : "none" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: crime.fill, flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", color: "var(--px-text-muted)" }}>{crime.name}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-base)", fontWeight: 700, color: "var(--px-text)" }}>{crime.value}</span>
                      <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginLeft: 8 }}>
                        {crimeStats?.data && crimeStats.data.total > 0 ? ((crime.value / (crimeStats.data.total || 1)) * 100).toFixed(1) + "%" : "0%"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Municipios Críticos */}
        {activeSection === "municipios" && (
          <div className="px-card" style={{ padding: "var(--px-5)" }}>
            <ModuleHeader title="TOP 10 MUNICIPIOS CRÍTICOS" eyebrow="Ordenados por nivel de riesgo y homicidios" />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-2)" }}>
              {criticalMunicipalities.map((mun: any, idx: number) => {
                const color = riskColor(mun.riesgo);
                return (
                  <div key={idx} className="px-card" style={{ padding: "var(--px-4)" }}>
                    <div className="flex items-center gap-3" style={{ marginBottom: "var(--px-2)" }}>
                      <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-base)", fontWeight: 700, color: "var(--px-text-faint)", width: 24 }}>{idx + 1}</span>
                      <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-md)", fontWeight: 600, color: "var(--px-text)", flex: 1 }}>{mun.municipio}</span>
                      <span className="px-delta" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{mun.riesgo}</span>
                      {mun.tendencia === "aumentando"
                        ? <TrendingUp style={{ width: 16, height: 16, color: "var(--px-crit)" }} />
                        : mun.tendencia === "disminuyendo"
                        ? <TrendingDown style={{ width: 16, height: 16, color: "var(--px-ok)" }} />
                        : <span style={{ width: 16, color: "var(--px-text-faint)" }}>—</span>}
                    </div>
                    <div className="grid grid-cols-4" style={{ gap: "var(--px-3)" }}>
                      {[
                        { l: "homicidios", v: mun.homicidios, c: "var(--px-crit)" },
                        { l: "robos", v: mun.robos, c: "var(--px-warn)" },
                        { l: "delitos", v: mun.delitos, c: "var(--px-brand)" },
                        { l: "víctimas", v: mun.victimas, c: "#8B5CF6" },
                      ].map((s) => (
                        <div key={s.l} style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>
                          <span style={{ fontWeight: 700, color: s.c }}>{s.v}</span> {s.l}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comparativa Mensual */}
        {activeSection === "comparativa" && monthComparison?.data && (
          <div className="px-card" style={{ padding: "var(--px-5)" }}>
            <ModuleHeader
              title="COMPARATIVA MES ACTUAL VS MES ANTERIOR"
              eyebrow={`${monthComparison.data.mesActual.mes}/${monthComparison.data.mesActual.anio} vs ${monthComparison.data.mesPasado.mes}/${monthComparison.data.mesPasado.anio}`}
            />
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "var(--px-5)" }}>
              <CompareBlock label="Delitos" actual={monthComparison.data.mesActual.delitos} anterior={monthComparison.data.mesPasado.delitos} cambio={monthComparison.data.cambioDelitos} pct={monthComparison.data.porcentajeDelitos} />
              <CompareBlock label="Víctimas" actual={monthComparison.data.mesActual.victimas} anterior={monthComparison.data.mesPasado.victimas} cambio={monthComparison.data.cambioVictimas} pct={monthComparison.data.porcentajeVictimas} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExecKpi({ label, value, icon, color, trend }: {
  label: string; value: number; icon: React.ReactNode; color: string; trend?: number;
}) {
  const display = useCounter(value);
  return (
    <div className="px-card flex flex-col justify-between" style={{ padding: "var(--px-5)", minHeight: 120 }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, color }}>{icon}</span>
        {trend !== undefined && <TrendBadge value={Math.round(trend)} />}
      </div>
      <div>
        <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xl)", fontWeight: 500, lineHeight: 1, color }}>{display.toLocaleString()}</div>
        <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", fontWeight: 600, color: "var(--px-text)", marginTop: 6 }}>{label}</div>
      </div>
    </div>
  );
}

function CompareBlock({ label, actual, anterior, cambio, pct }: {
  label: string; actual: number; anterior: number; cambio: number; pct: number;
}) {
  const bad = cambio > 0;
  const color = bad ? "var(--px-crit)" : "var(--px-ok)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-2)" }}>
      <div className="px-section-title">{label}</div>
      <div className="flex justify-between items-center" style={{ padding: "var(--px-3)", borderRadius: "var(--px-r-sm)", background: "var(--px-surface)" }}>
        <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", color: "var(--px-text-muted)" }}>Mes Actual</span>
        <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-md)", fontWeight: 700, color: "var(--px-text)" }}>{actual}</span>
      </div>
      <div className="flex justify-between items-center" style={{ padding: "var(--px-3)", borderRadius: "var(--px-r-sm)", background: "var(--px-surface)" }}>
        <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", color: "var(--px-text-muted)" }}>Mes Anterior</span>
        <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-md)", fontWeight: 700, color: "var(--px-text)" }}>{anterior}</span>
      </div>
      <div className="flex justify-between items-center" style={{ padding: "var(--px-3)", borderRadius: "var(--px-r-sm)", background: `color-mix(in srgb, ${color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
        <span style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", fontWeight: 600, color: "var(--px-text-muted)" }}>Cambio</span>
        <div className="flex items-center gap-2">
          {bad ? <TrendingUp style={{ width: 16, height: 16, color }} /> : <TrendingDown style={{ width: 16, height: 16, color }} />}
          <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-md)", fontWeight: 700, color }}>
            {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
