export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded ${className || ""}`}
      style={{ background: "var(--px-hairline)", ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="px-card" style={{ padding: "var(--px-5)" }}>
      <Skeleton style={{ width: "40%", height: 12, marginBottom: 12 }} />
      <Skeleton style={{ width: "70%", height: 28, marginBottom: 8 }} />
      <Skeleton style={{ width: "55%", height: 10 }} />
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="px-card" style={{ padding: "var(--px-5)", minHeight: 148 }}>
      <Skeleton style={{ width: 34, height: 34, borderRadius: 9 }} />
      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <Skeleton style={{ width: "60%", height: 32, marginBottom: 8 }} />
        <Skeleton style={{ width: "45%", height: 12 }} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3" style={{ padding: "8px 0" }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} style={{ flex: j === 0 ? 2 : 1, height: 14 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
