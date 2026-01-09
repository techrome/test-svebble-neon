import { trpc, withAuth, withReqRes } from "./core";
import { rateLimitMiddlewares } from "./ratelimit";

export const publicProcedure = trpc.procedure;
export const publicProcedureDefaultRateLimit = publicProcedure.use(
  rateLimitMiddlewares.default
);

export const publicProcedureHttp = publicProcedure.use(withReqRes);
export const publicProcedureHttpDefaultRateLimit = publicProcedureHttp.use(
  rateLimitMiddlewares.default
);

export const privateProcedureHttp = publicProcedure
  .use(withReqRes)
  .use(withAuth);
export const privateProcedureHttpDefaultRateLimit = privateProcedureHttp.use(
  rateLimitMiddlewares.default
);
