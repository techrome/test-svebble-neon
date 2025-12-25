import { initTRPC, TRPCError } from "@trpc/server";
import superJSON from "superjson";
import z, { ZodError } from "zod";

import { isDev } from "@@/scripts/helpers/isDev";
import { type TRPCContext } from "./context";

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

export const router = trpc.router;
export const publicProcedure = trpc.procedure;

export const privateProcedure = trpc.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx });
});
