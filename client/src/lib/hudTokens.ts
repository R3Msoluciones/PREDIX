/**
 * hudTokens.ts — Paleta "sobrio-institucional" compartida por el chrome de
 * la app (Header, NotificationPanel). Antes vivía duplicada letra por letra
 * en ambos archivos (mismos hex, misma tipografía) — unificada aquí para que
 * no diverjan si algún día se ajusta un color o una fuente.
 */

export const HUD = {
  textTitle: "#E6ECF5",
  textBody: "#AEBACB",
  textMeta: "#6B7A92",
  textActive: "#C6D2E3",
  border: "rgba(255,255,255,0.1)",
  borderSoft: "rgba(255,255,255,0.08)",
  hover: "rgba(255,255,255,0.035)",
  brand: "#00D4FF",
  live: "#3DA35D",
  warn: "#E5A23D",
  crit: "#E5484D",
  mono: "IBM Plex Mono, monospace",
  display: "Rajdhani, sans-serif",
  sans: "Inter, 'Segoe UI', system-ui, sans-serif",
} as const;
