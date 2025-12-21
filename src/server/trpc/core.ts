import { initTRPC } from "@trpc/server";
import superJSON from "superjson";
import z, { ZodError } from "zod";

import { isDev } from "@@/scripts/helpers/isDev.mjs";

const trpc = initTRPC.create({
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
export const procedure = trpc.procedure;
