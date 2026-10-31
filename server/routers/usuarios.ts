import { z } from "zod";
import { requirePermission, router } from "../_core/infra/trpc";
import { getDb } from "../config/db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";
import { toPublicUser } from "../_core/auth/sanitizeUser";
import { hashPassword } from "../_core/auth/password";
import { logAudit } from "../config/auditLog";
import { MODULES } from "../_core/infra/permissions";

const institutionalRoleSchema = z.enum(["operador", "supervisor", "analista", "admin", "consulta", "policia", "comandante"]);

export const usuariosRouter = router({
  listar: requirePermission(MODULES.ADMIN, "canView").query(async () => {
    const db = await getDb();
    if (!db) return { data: [], origen: "sin_bd" as const };
    try {
      const rows = await db.select().from(users);
      return { data: rows.map(toPublicUser), origen: "real" as const };
    } catch (e) {
      logger.error("[Usuarios] Error listing:", e);
      return { data: [], origen: "error" as const };
    }
  }),

  crear: requirePermission(MODULES.ADMIN, "canEdit")
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      institutionalRole: institutionalRoleSchema,
      institution: z.string().optional(),
      department: z.string().optional(),
      employeeId: z.string().optional(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const openId = `manual:${input.email}`;
      const passwordHash = await hashPassword(input.password);
      const result = await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "manual",
        institutionalRole: input.institutionalRole,
        status: "active",
        institution: input.institution,
        department: input.department,
        employeeId: input.employeeId,
        passwordHash,
      });
      await logAudit({
        userId: ctx.user.id,
        action: "CREATE_USER",
        module: "usuarios",
        resourceId: String(result[0].insertId),
        details: input.email,
        ip: ctx.req.ip || "unknown",
      });
      return { success: true, id: result[0].insertId };
    }),

  actualizar: requirePermission(MODULES.ADMIN, "canEdit")
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      institutionalRole: institutionalRoleSchema.optional(),
      department: z.string().optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const { id, ...rest } = input;
      await db.update(users).set(rest).where(eq(users.id, id));
      await logAudit({
        userId: ctx.user.id,
        action: "UPDATE_USER",
        module: "usuarios",
        resourceId: String(id),
        ip: ctx.req.ip || "unknown",
      });
      return { success: true };
    }),

  resetPassword: requirePermission(MODULES.ADMIN, "canEdit")
    .input(z.object({
      id: z.number(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const passwordHash = await hashPassword(input.password);
      await db.update(users).set({ passwordHash }).where(eq(users.id, input.id));
      await logAudit({
        userId: ctx.user.id,
        action: "RESET_PASSWORD",
        module: "usuarios",
        resourceId: String(input.id),
        ip: ctx.req.ip || "unknown",
      });
      return { success: true };
    }),

  eliminar: requirePermission(MODULES.ADMIN, "canDelete")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(users).where(eq(users.id, input.id));
      await logAudit({
        userId: ctx.user.id,
        action: "DELETE_USER",
        module: "usuarios",
        resourceId: String(input.id),
        ip: ctx.req.ip || "unknown",
      });
      return { success: true };
    }),
});
