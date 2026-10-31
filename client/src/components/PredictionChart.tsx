/**
 * PredictionChart — Gráfica de la proyección de delitos con rango esperado.
 * Solo la gráfica: el estado de riesgo y las acciones ya se muestran en
 * PrediccionesTab.tsx, este componente no debe repetirlos.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface PredictionData {
  municipio: string;
  mes: number;
  anio: number;
  prediccion: number;
  confianza: number;
  tendencia: "al_alza" | "a_la_baja" | "estable";
  intervaloConfianza: {
    minimo: number;
    maximo: number;
  };
}

interface PredictionChartProps {
  predicciones: PredictionData[];
  municipio: string;
  tendencia: "al_alza" | "a_la_baja" | "estable";
  riesgo: "bajo" | "medio" | "alto" | "crítico";
}

export default function PredictionChart({ predicciones }: PredictionChartProps) {
  const chartData = predicciones.map((p) => ({
    fecha: `${p.mes}/${p.anio}`,
    prediccion: p.prediccion,
    minimo: p.intervaloConfianza.minimo,
    maximo: p.intervaloConfianza.maximo,
  }));

  return (
    <div style={{ padding: "var(--px-3) var(--px-4)", border: "1px solid var(--px-hairline)", borderRadius: "var(--px-r-sm)" }}>
      <div className="px-eyebrow" style={{ marginBottom: "var(--px-2)" }}>Proyección de delitos</div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="predRangeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--px-brand)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--px-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--px-hairline)" vertical={false} />
          <XAxis dataKey="fecha" stroke="var(--px-text-faint)" tick={{ fontFamily: "var(--px-mono)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis stroke="var(--px-text-faint)" tick={{ fontFamily: "var(--px-mono)", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--px-surface)",
              border: "1px solid var(--px-hairline-strong)",
              borderRadius: 8,
              fontFamily: "var(--px-body)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--px-text)", fontWeight: 600 }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = { prediccion: "Estimado", maximo: "Máximo esperado", minimo: "Mínimo esperado" };
              return [value, labels[name] || name];
            }}
          />
          <Area type="monotone" dataKey="maximo" stroke="none" fill="url(#predRangeFill)" isAnimationActive={false} />
          <Line type="monotone" dataKey="minimo" stroke="var(--px-hairline-strong)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} name="minimo" />
          <Line type="monotone" dataKey="prediccion" stroke="var(--px-brand)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--px-brand)" }} name="prediccion" />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)", marginTop: 4 }}>
        La línea sólida es el estimado; la banda sombreada es el rango esperado (puede variar dentro de ese margen).
      </div>
    </div>
  );
}
