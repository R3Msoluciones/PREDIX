import { useCounter } from "@/hooks/useCounter";
import { Sparkline } from "./Sparkline";

export function KpiCard({ icon, label, value, suffix, color, spark, delta }: {
  icon: React.ReactNode; label: string; value: number; suffix?: string; color: string;
  spark: number[]; delta: React.ReactNode;
}) {
  const display = useCounter(value);
  return (
    <div className="px-card relative overflow-hidden flex flex-col justify-between" style={{ padding: "var(--px-5)", minHeight: 148 }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, color }}>{icon}</span>
        {delta}
      </div>
      <div>
        <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-2xl)", fontWeight: 500, lineHeight: 1, color }}>
          {display.toLocaleString()}
          {suffix && <span style={{ fontSize: "var(--px-text-md)", color: "var(--px-text-faint)" }}>{suffix}</span>}
        </div>
        <div style={{ fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", fontWeight: 600, color: "var(--px-text)", marginTop: 6 }}>{label}</div>
      </div>
      <Sparkline values={spark} color={color} />
    </div>
  );
}
