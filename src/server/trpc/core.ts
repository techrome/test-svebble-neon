import { initTRPC } from "@trpc/server";
import superJSON from "superjson";
import z, { ZodError } from "zod";

import { isDev } from "@@/scripts/helpers/isDev";
import { type TRPCContext } from "./context";
import { assertHasReqRes, assertIsAuthed } from "./helpers/assert";
import { APIError } from "better-auth";

export const trpc = initTRPC.context<TRPCContext>().create({
  isDev,
  transformer: superJSON,
  errorFormatter: (opts) => {
    const { shape, error } = opts;

    const isBetterAuthError = error.cause instanceof APIError;
    const isProd500Error =
      !isDev &&
      (isBetterAuthError
        ? error.cause.statusCode === 500 ||
          error.cause.status === "INTERNAL_SERVER_ERROR"
        : shape.data.httpStatus === 500 ||
          error.code === "INTERNAL_SERVER_ERROR");

    if (isProd500Error) {
      return {
        message: "Something went wrong.",
        code: shape.code,
        data: {
          code: shape.data.code,
          httpStatus: shape.data.httpStatus,
          path: shape.data.path,
          zodError: null,
        },
      };
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        code: isBetterAuthError ? error.cause.status : shape.data.code,
        httpStatus: isBetterAuthError
          ? error.cause.statusCode
          : shape.data.httpStatus,
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

export const withReqRes = trpc.middleware(({ ctx, next }) => {
  assertHasReqRes(ctx);
  return next({ ctx });
});

export const withAuth = trpc.middleware(({ ctx, next }) => {
  assertHasReqRes(ctx);
  assertIsAuthed(ctx);
  return next({ ctx });
});

export const router = trpc.router;
