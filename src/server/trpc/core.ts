import { initTRPC } from "@trpc/server";
import superJSON from "superjson";
import z, { ZodError } from "zod";

import { isDev } from "@@/scripts/helpers/isDev";
import { type TRPCContext } from "./context";
import { assertHasReqRes, assertIsAuthed } from "./helpers/assert";

const trpc = initTRPC.context<TRPCContext>().create({
  isDev,
  transformer: superJSON,
  errorFormatter: (opts) => {
    const { shape, error } = opts;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof ZodError
            ? {
                flattened: z.flattenError(error.cause),
                tree: z.treeifyError(error.cause),
                issues: error.cause?.issues,
              }
            : null,
      },
    };
  },
});

const withReqRes = trpc.middleware(({ ctx, next }) => {
  assertHasReqRes(ctx);
  return next({ ctx });
});

const withAuth = trpc.middleware(({ ctx, next }) => {
  assertIsAuthed(ctx);
  return next({ ctx });
});

export const router = trpc.router;

export const publicProcedure = trpc.procedure;
export const publicProcedureHttp = publicProcedure.use(withReqRes);

export const privateProcedure = publicProcedure.use(withAuth);
export const privateProcedureHttp = privateProcedure.use(withReqRes);
