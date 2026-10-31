export function freshness(date: Date | string | null): { ago: string; exact: string } {
  if (!date) return { ago: "Sin sincronizar", exact: "Sin registro de sincronización" };
  const dt = date instanceof Date ? date : new Date(date);
  const secs = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  let ago: string;
  if (secs < 60) ago = "Hace un momento";
  else if (secs < 3600) ago = `Hace ${Math.floor(secs / 60)} min`;
  else if (secs < 86400) ago = `Hace ${Math.floor(secs / 3600)} h`;
  else ago = `Hace ${Math.floor(secs / 86400)} d`;
  const exact = dt.toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return { ago, exact };
}
