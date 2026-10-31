import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/auth/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/infra/trpc";
import { incidenciaRouter } from "./routers/incidencia";
import { authRouter, MODULES, DEFAULT_PERMISSIONS } from "./routers/auth";
import { prediccionesRouter } from "./routers/predicciones";
import { dashboardRouter } from "./routers/dashboard";
import { reportsRouter } from "./routers/reports";
import { integrationRouter } from "./routers/integration";
import { vaultRouter } from "./routers/vault";
import { alertasRouter } from "./routers/alertas";
import { usuariosRouter } from "./routers/usuarios";
import { incidentesRouter } from "./routers/incidentes";
import { adminRouter } from "./routers/admin";
import { aiRouter } from "./routers/ai";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,
  incidencia: incidenciaRouter,
  predicciones: prediccionesRouter,
  dashboard: dashboardRouter,
  reports: reportsRouter,
  integration: integrationRouter,
  vault: vaultRouter,
  alertas: alertasRouter,
  usuarios: usuariosRouter,
  incidentes: incidentesRouter,
  admin: adminRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
