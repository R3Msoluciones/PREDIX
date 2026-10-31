export function ModuleHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3" style={{ marginBottom: "var(--px-4)" }}>
      <div>
        <div className="px-section-title">{title}</div>
        <div className="px-section-sub" style={{ marginTop: 2 }}>{eyebrow}</div>
      </div>
      {action}
    </div>
  );
}
