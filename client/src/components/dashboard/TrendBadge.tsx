import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function TrendBadge({ value, goodDown = true }: { value: number; goodDown?: boolean }) {
  if (value === 0) return <span className="px-delta" style={{ color: "var(--px-text-faint)", background: "rgba(255,255,255,0.05)" }}><Minus size={11} /> 0%</span>;
  const up = value > 0;
  const bad = goodDown ? up : !up;
  const color = bad ? "var(--px-crit)" : "var(--px-ok)";
  return (
    <span className="px-delta" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {Math.abs(value)}%
    </span>
  );
}
