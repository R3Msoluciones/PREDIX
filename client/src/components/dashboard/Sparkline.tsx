export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 200},${42 - ((v - min) / range) * 36 - 3}`);
  const area = `0,42 ${pts.join(" ")} 200,42`;
  return (
    <svg className="absolute inset-x-0 bottom-0" style={{ height: 42, opacity: 0.5 }} viewBox="0 0 200 42" preserveAspectRatio="none">
      <polygon points={area} fill={color} fillOpacity={0.14} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
