export function DataRow({ icon, label, value, color, last }: {
  icon: React.ReactNode; label: string; value: string; color: string; last?: boolean;
}) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "11px 0", borderBottom: last ? "none" : "1px solid var(--px-hairline)" }}>
      <span className="flex" style={{ color, opacity: 0.85, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontFamily: "var(--px-body)", fontSize: "var(--px-text-base)", color: "var(--px-text-muted)" }} className="truncate">{label}</span>
      <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-base)", fontWeight: 600, color, whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
