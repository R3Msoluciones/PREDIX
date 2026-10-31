export function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center" style={{ minHeight: 120, fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text-faint)" }}>{text}</div>;
}
