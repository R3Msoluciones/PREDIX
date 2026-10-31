/**
 * auth.ts — Procedimientos de autenticación institucional
 * Maneja login, logout, permisos y control de acceso
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/infra/trpc";
import { getDb } from "../config/db";
import { users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/auth/cookies";
import { toPublicUser } from "../_core/auth/sanitizeUser";
import { hashPassword, verifyPassword } from "../_core/auth/password";
import * as db from "../config/db";
import { sdk } from "../_core/sdk";

// Hash dummy precomputado una sola vez — usado para igualar el costo de bcrypt
// cuando el usuario no existe, cerrando el timing side-channel de institutionalLogin.
const DUMMY_HASH = hashPassword("dummy-password-para-timing-constante");

import { MODULES, DEFAULT_PERMISSIONS } from "../_core/infra/permissions";
import { getRolePermissions } from "../services/permissionsCache";
export { MODULES, DEFAULT_PERMISSIONS };

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => (ctx.user ? toPublicUser(ctx.user) : null)),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(
      COOKIE_NAME,
      {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      } as Parameters<typeof ctx.res.clearCookie>[1]
    );

    return { success: true };
  }),

  // Institutional login
  institutionalLogin: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        employeeId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);

      // Comparar siempre contra un hash (real o dummy) para que el costo de
      // bcrypt sea constante — evita que el tiempo de respuesta filtre si el
      // email existe (enumeración de cuentas vía timing side-channel).
      const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? (await DUMMY_HASH));

      if (
        !user ||
        !user.passwordHash ||
        user.employeeId !== input.employeeId ||
        user.status !== "active" ||
        !passwordOk
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Credenciales inválidas",
        });
      }

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

      return {
        success: true,
        role: user.institutionalRole,
      };
    }),

  // Get user permissions for a module
  getModulePermissions: protectedProcedure
    .input(z.object({ module: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user?.id || 0))
        .limit(1);

      if (!user.length) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuario no encontrado",
        });
      }

      const userRole = user[0].institutionalRole;
      const permissions = await getRolePermissions(userRole);
      return permissions[input.module] || { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 };
    }),

  // Check if user can access module
  canAccessModule: protectedProcedure
    .input(z.object({ module: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user?.id || 0))
        .limit(1);

      if (!user.length || user[0].status !== "active") {
        return false;
      }

      const userRole = user[0].institutionalRole;
      const permissions = await getRolePermissions(userRole);
      return permissions[input.module]?.canView === 1;
    }),

  // Get all modules accessible by user
  getAccessibleModules: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user?.id || 0))
      .limit(1);

    if (!user.length || user[0].status !== "active") {
      return [];
    }

    const userRole = user[0].institutionalRole;
    const permissions = await getRolePermissions(userRole);

    return Object.entries(permissions)
      .filter(([, perms]) => perms.canView === 1)
      .map(([module]) => module);
  }),

  // Get user profile with role and permissions
  getUserProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user?.id || 0))
      .limit(1);

    if (!user.length) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Usuario no encontrado",
      });
    }

    const userData = user[0];
    const userRole = userData.institutionalRole;
    const permissions = await getRolePermissions(userRole);

    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      institutionalRole: userData.institutionalRole,
      institution: userData.institution,
      department: userData.department,
      employeeId: userData.employeeId,
      status: userData.status,
      permissions,
    };
  }),
});
