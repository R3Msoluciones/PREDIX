import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Antes leía el tema de "next-themes" — una librería que este proyecto nunca
// monta (su ThemeProvider no existe en ningún lado del árbol). Sin proveedor,
// el hook caía a "system" y sonner terminaba resolviendo el modo claro/oscuro
// del SISTEMA OPERATIVO, desconectado del tema real de la app (@/contexts/
// ThemeContext, siempre "dark" — ver App.tsx). Por eso los toasts salían en
// paleta clara (rosa/verde pastel) sobre una app que es oscura en todo lo demás.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        richColors
        style={
          {
            // Paleta táctica real (--px-*) en vez del tema por defecto de sonner
            // — mismos colores de severidad que ya usan NotificationPanel y la
            // lista de Alertas (crítico/warn/ok/brand), no un verde/rojo pastel ajeno.
            "--normal-bg": "var(--px-surface-2)",
            "--normal-border": "var(--px-hairline-strong)",
            "--normal-text": "var(--px-text)",
            "--success-bg": "var(--px-surface-2)",
            "--success-border": "color-mix(in srgb, var(--px-ok) 45%, transparent)",
            "--success-text": "var(--px-ok)",
            "--error-bg": "var(--px-surface-2)",
            "--error-border": "color-mix(in srgb, var(--px-crit) 45%, transparent)",
            "--error-text": "var(--px-crit)",
            "--warning-bg": "var(--px-surface-2)",
            "--warning-border": "color-mix(in srgb, var(--px-warn) 45%, transparent)",
            "--warning-text": "var(--px-warn)",
            "--info-bg": "var(--px-surface-2)",
            "--info-border": "color-mix(in srgb, var(--px-brand) 45%, transparent)",
            "--info-text": "var(--px-brand)",
          } as React.CSSProperties
        }
        {...props}
      />
      {/* Estilos inline (no en index.css): el pipeline de Tailwind v4 de este
          proyecto se traga reglas planas dirigidas a [data-sonner-toast] puestas
          en el CSS global (verificado — nunca llegan al navegador), mismo patrón
          por el que NotificationPanel.tsx ya usa un <style> propio en vez de
          index.css para sus animaciones. Spine de severidad = mismo lenguaje
          visual que EventItem/AlertList (barra de color a la izquierda). */}
      <style>{`
        [data-sonner-toaster] { font-family: var(--px-mono); }
        [data-sonner-toast] {
          position: relative;
          overflow: hidden;
          border-radius: var(--px-r-sm) !important;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45) !important;
        }
        [data-sonner-toast]::before {
          content: "";
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--px-text-faint);
        }
        [data-sonner-toast][data-type="success"]::before { background: var(--success-text); }
        [data-sonner-toast][data-type="error"]::before { background: var(--error-text); }
        [data-sonner-toast][data-type="warning"]::before { background: var(--warning-text); }
        [data-sonner-toast][data-type="info"]::before { background: var(--info-text); }
        [data-sonner-toast] [data-title] {
          font-family: var(--px-mono);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        [data-sonner-toast] [data-description] {
          font-family: var(--px-body);
          font-size: 0.74rem;
        }
      `}</style>
    </>
  );
};

export { Toaster };
