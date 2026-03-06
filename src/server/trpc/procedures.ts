import { TRPCError } from "@trpc/server";

import { trpc } from "./core";
import { rateLimitMiddlewares } from "./ratelimit";
import { TRPCContext, TRPCContextWithReqRes } from "./context";
import { hasPermissions, RolePermissions } from "@/utils/hasPermissions";

const assertHasReqRes: (
  ctx: TRPCContext
) => asserts ctx is TRPCContextWithReqRes = (ctx) => {
  if (!ctx.req || !ctx.res) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "This procedure requires an HTTP request context (req/res)",
    });
  }
};

export const withReqRes = trpc.middleware(({ ctx, next }) => {
  assertHasReqRes(ctx);
  return next({ ctx });
});

export const withCachedAuth = trpc.middleware(async ({ ctx, next }) => {
  assertHasReqRes(ctx);

  const authResponse = await ctx.getCachedAuth();
  if (!authResponse?.response?.user || !authResponse?.response?.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      user: authResponse.response.user,
      session: authResponse.response.session,
    },
  });
});

const withAuth = trpc.middleware(async ({ ctx, next }) => {
  assertHasReqRes(ctx);

  const authResponse = await ctx.getAuth();
  if (!authResponse?.response?.user || !authResponse?.response?.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      user: authResponse.response.user,
      session: authResponse.response.session,
    },
  });
});

const withPermissionCheck = (neededPerms: RolePermissions) =>
  trpc.middleware(async ({ ctx, next }) => {
    const authResponse = await ctx.getAuth();

    if (!authResponse?.response?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (!hasPermissions(authResponse?.response?.user, neededPerms)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Action not allowed",
      });
    }

    return next();
  });

export const publicProcedureSSR = trpc.procedure;
export const publicProcedureSSRDefaultRateLimit = publicProcedureSSR.use(
  rateLimitMiddlewares.default
);

export const publicProcedure = publicProcedureSSR.use(withReqRes);
export const publicProcedureDefaultRateLimit = publicProcedure.use(
  rateLimitMiddlewares.default
);

export const privateCachedProcedure = (
  neededPerms: RolePermissions,
  ratelimiter?: (typeof rateLimitMiddlewares)[keyof typeof rateLimitMiddlewares]
) =>
  publicProcedure
    .use(ratelimiter || rateLimitMiddlewares.default)
    .use(withCachedAuth)
    .use(withPermissionCheck(neededPerms));
export const privateProcedure = (
  neededPerms: RolePermissions,
  ratelimiter?: (typeof rateLimitMiddlewares)[keyof typeof rateLimitMiddlewares]
) =>
  publicProcedure
    .use(ratelimiter || rateLimitMiddlewares.default)
    .use(withAuth)
    .use(withPermissionCheck(neededPerms));
