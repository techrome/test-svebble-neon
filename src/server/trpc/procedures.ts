import { trpc, withAuth, withReqRes } from "./core";
import { rateLimitMiddlewares } from "./ratelimit";

export const publicProcedureSSR = trpc.procedure;
export const publicProcedureSSRDefaultRateLimit = publicProcedureSSR.use(
  rateLimitMiddlewares.default
);

export const publicProcedure = publicProcedureSSR.use(withReqRes);
export const publicProcedureDefaultRateLimit = publicProcedure.use(
  rateLimitMiddlewares.default
);

export const privateProcedure = publicProcedureSSR
  .use(withReqRes)
  .use(withAuth);
export const privateProcedureDefaultRateLimit = privateProcedure.use(
  rateLimitMiddlewares.default
);
