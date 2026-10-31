import { FlaskConical } from "lucide-react";

export function OriginBadge({ real }: { real: boolean }) {
  const color = real ? "var(--px-ok)" : "var(--px-warn)";
  return (
    <span className="flex items-center gap-2" style={{
      fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", letterSpacing: "0.1em",
      color, background: `color-mix(in srgb, ${color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
      borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap",
    }}>
      <FlaskConical size={13} /> {real ? "DATOS REALES · SESNSP" : "DATOS SIMULADOS"}
    </span>
  );
}
