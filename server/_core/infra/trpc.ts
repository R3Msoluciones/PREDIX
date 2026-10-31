import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "../auth/context";
import type { ModuleName, PermissionAction } from "./permissions";
import { getModulePermissions } from "../../services/permissionsCache";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export function requirePermission(module: ModuleName, action: PermissionAction) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const role = ctx.user.institutionalRole;
    const modulePermissions = await getModulePermissions(role, module);
    if (!modulePermissions[action]) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Tu rol no tiene permiso para esta acción" });
    }
    return next();
  });
}
