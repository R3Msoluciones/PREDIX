// ============================================================
// LOGIN — Consola de autorización táctica (PREDIX v2)
// Login institucional real (auth.institutionalLogin) contra la tabla users.
// Diseño: split console con hero geoespacial EdoMéx + telemetría viva.
// ============================================================

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

function useUtcClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(time.getUTCHours())}:${p(time.getUTCMinutes())}:${p(time.getUTCSeconds())}`;
}

function GeoPanel() {
  return (
    <div className="px-login-geo">
      <svg viewBox="0 0 360 350" role="img" aria-label="Mapa de monitoreo del Estado de México">
        <defs>
          <radialGradient id="pxSweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,212,255,0.35)" />
            <stop offset="100%" stopColor="rgba(0,212,255,0)" />
          </radialGradient>
          <clipPath id="pxStateClip">
            <path d="M150 20 L205 30 L245 70 L240 110 L275 130 L300 175 L270 205 L285 250 L250 300 L195 320 L150 300 L120 320 L85 295 L100 250 L70 220 L95 180 L60 150 L80 105 L120 95 L120 55 Z" />
          </clipPath>
        </defs>
        <path
          className="px-login-state"
          d="M150 20 L205 30 L245 70 L240 110 L275 130 L300 175 L270 205 L285 250 L250 300 L195 320 L150 300 L120 320 L85 295 L100 250 L70 220 L95 180 L60 150 L80 105 L120 95 L120 55 Z"
        />
        <g clipPath="url(#pxStateClip)">
          {[60, 110, 160, 210, 260].map((x) => (
            <line key={`v${x}`} className="px-login-grid" x1={x} y1={20} x2={x} y2={320} />
          ))}
          {[80, 140, 200, 260].map((y) => (
            <line key={`h${y}`} className="px-login-grid" x1={60} y1={y} x2={300} y2={y} />
          ))}
          <g className="px-login-radar">
            <path d="M180 175 L180 0 A175 175 0 0 1 320 90 Z" fill="url(#pxSweepGrad)" />
          </g>
        </g>
        {[
          [150, 90, ""], [200, 120, "b"], [170, 170, "c"], [230, 200, "d"],
          [130, 220, "e"], [195, 260, "b"], [110, 160, "d"], [250, 150, ""],
        ].map(([cx, cy, cls], i) => (
          <circle key={i} className={`px-login-node ${cls}`} cx={cx as number} cy={cy as number} r={2.6} />
        ))}
      </svg>
      <span className="px-login-geo-caption">// Monitoreo geoespacial en tiempo real</span>
    </div>
  );
}

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, refresh } = useAuth();
  const clock = useUtcClock();

  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const loginMutation = trpc.auth.institutionalLogin.useMutation();

  // Si ya hay sesión real (cookie válida), salta el login.
  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!employeeId || !email || !password) {
      setError("Completa todos los campos.");
      return;
    }
    try {
      await loginMutation.mutateAsync({ employeeId, email, password });
      await refresh();
      navigate("/", { replace: true });
    } catch {
      setError("Credenciales inválidas. Verifica tu número de empleado, correo y contraseña.");
    }
  };

  return (
    <div className="px-login-root">
      <div className="px-login-classif">
        <span className="dot" />
        Acceso restringido · Sistema oficial · Estado de México
        <span className="dot" />
      </div>

      <main className="px-login-split">
        {/* HERO */}
        <section className="px-login-hero">
          <div>
            <div className="px-login-wordmark">
              <h1>
                PRE<span className="accent">DIX</span>
              </h1>
              <span className="tag">
                Sistema Estatal
                <br />
                de Inteligencia
              </span>
            </div>
            <p className="px-login-hero-sub">Centro de comando · Seguridad pública · 125 municipios</p>
          </div>

          <GeoPanel />

          <div className="px-login-telemetry">
            <div className="label">// Telemetría del sistema</div>
            <div className="px-login-tele-grid">
              <div className="px-login-tele-row">
                <span className="k">UTC</span>
                <span className="v">{clock}</span>
              </div>
              <div className="px-login-tele-row">
                <span className="k">NODOS</span>
                <span className="v on">
                  <span className="led" />
                  125/125
                </span>
              </div>
              <div className="px-login-tele-row">
                <span className="k">ENLACE C5</span>
                <span className="v on">
                  <span className="led" />
                  ACTIVO
                </span>
              </div>
              <div className="px-login-tele-row">
                <span className="k">BUILD</span>
                <span className="v">v1.0 · 0615</span>
              </div>
            </div>
          </div>
        </section>

        {/* CONSOLA */}
        <section className="px-login-console">
          <div className="px-login-console-head">
            <div className="eyebrow">// Autenticación</div>
            <h2>Iniciar sesión</h2>
            <p>Ingresa con tus credenciales institucionales.</p>
          </div>

          {error && (
            <div className="px-login-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="px-login-field">
              <label htmlFor="emp">Número de empleado</label>
              <input
                id="emp"
                className="px-login-input"
                type="text"
                autoComplete="username"
                placeholder="EMP-2026-001"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>
            <div className="px-login-field">
              <label htmlFor="mail">Correo institucional</label>
              <input
                id="mail"
                className="px-login-input"
                type="email"
                autoComplete="email"
                placeholder="usuario@edomex.gob.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="px-login-field">
              <label htmlFor="pwd">Contraseña</label>
              <div className="px-login-input-wrap">
                <input
                  id="pwd"
                  className="px-login-input"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="px-login-eye"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="px-login-submit">
              Iniciar sesión <ArrowRight size={16} />
            </button>
          </form>
        </section>
      </main>

      <footer className="px-login-foot">
        <span>Gobierno del Estado de México · Uso oficial</span>
        <span>Datos simulados · Auditoría activa</span>
      </footer>
    </div>
  );
}
