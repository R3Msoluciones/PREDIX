import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./auth/context";
import { serveStatic, setupVite } from "./infra/vite";
import { sseHandler, eventBus } from "../services/realtimeService";
import { sdk } from "./sdk";
import { resolveAttachmentPath } from "../config/storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Railway (y la mayoría de PaaS) corren detrás de un proxy inverso que
  // agrega X-Forwarded-For; sin esto, express-rate-limit lo rechaza.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production"
      ? {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            // Mapa base del mapa táctico (TacticalMap.tsx) — OpenFreeMap (MapLibre GL, sin API key).
            "img-src": ["'self'", "data:", "blob:", "https://tiles.openfreemap.org"],
            "connect-src": ["'self'", "https://tiles.openfreemap.org"],
            "worker-src": ["'self'", "blob:"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS — allowlist por entorno
  const corsOrigins = process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
    : process.env.VITE_FRONTEND_URL
      ? process.env.VITE_FRONTEND_URL.split(",").map((u) => u.trim())
      : [];
  app.use(cors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }));

  // Rate limiting en login institucional
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera 15 minutos." },
  });
  app.use("/api/trpc/auth.institutionalLogin", loginLimiter);

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", apiLimiter);

  // El asistente IA depende de la capa gratuita de Google (Gemini),
  // compartida entre todos los usuarios de PREDIX — un límite propio, más
  // estricto que el apiLimiter general, evita que un solo usuario/script
  // agote la cuota compartida o la use para exfiltrar datos con preguntas
  // repetidas. OJO: la cuota diaria real varía MUCHO por modelo — verificado
  // en carne propia que gemini-3.5-flash solo daba 20 solicitudes/día en
  // capa gratuita (no los "1,500/día" que la documentación de terceros
  // sugería); se migró a gemini-3.1-flash-lite por eso
  // Si `ai.chat` empieza a fallar con 429 "RESOURCE_EXHAUSTED" seguido,
  // el mensaje de error de Google (logueado por chatAssistant.ts) dice la
  // cuota real vigente — confiar en ese error, no en un número fijo aquí.
  //
  // Se limita por USUARIO autenticado, no por IP: varios operadores de un
  // mismo centro de mando comparten la IP de oficina (NAT) — limitar por IP
  // los bloquearía entre sí. Sin sesión válida (llegará 401 de todos modos)
  // cae a IP como respaldo.
  const chatRateLimitKey = async (req: express.Request) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user) return `user:${user.id}`;
    } catch {
      // sin sesión válida — usa IP como respaldo
    }
    return ipKeyGenerator(req.ip ?? "unknown");
  };
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: chatRateLimitKey,
    message: { error: "Demasiadas consultas al asistente. Espera un minuto." },
  });
  app.use("/api/trpc/ai.chat", chatLimiter);
  const chatDailyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: chatRateLimitKey,
    message: { error: "Se alcanzó el límite diario de consultas al asistente." },
  });
  app.use("/api/trpc/ai.chat", chatDailyLimiter);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // SSE endpoint para notificaciones en tiempo real
  app.get("/api/events", sseHandler);

  // API para obtener historial de eventos
  app.get("/api/events/history", (_req, res) => {
    res.json({
      events: eventBus.getHistory(50),
      clients: eventBus.getClientCount(),
    });
  });

  // Descarga de adjuntos de incidentes — requiere sesión válida, sirve
  // desde disco local (ver server/config/storage.ts).
  app.get("/api/attachments/file/:key(*)", async (req, res) => {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) return res.status(401).json({ error: "UNAUTHORIZED" });

    let filePath: string;
    try {
      filePath = resolveAttachmentPath(req.params.key);
    } catch {
      return res.status(400).json({ error: "INVALID_PATH" });
    }

    // Un adjunto puede ser cualquier archivo que un usuario haya subido (ej.
    // un .html o .svg con <script> disfrazado de "evidencia"). Sin estas
    // cabeceras, el navegador lo renderizaría inline en el mismo origen que
    // la sesión autenticada — XSS almacenado vía carga de archivos.
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");

    res.sendFile(filePath, err => {
      if (err) res.status(404).json({ error: "NOT_FOUND" });
    });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
