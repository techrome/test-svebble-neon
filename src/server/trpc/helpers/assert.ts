import { TRPCError } from "@trpc/server";
import {
  TRPCContext,
  TRPCContextWithReqRes,
  TRPCContextAuthed,
} from "../context";

export const assertHasReqRes: (
  ctx: TRPCContext
) => asserts ctx is TRPCContextWithReqRes = (ctx) => {
  if (!ctx.req || !ctx.res) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "This procedure requires an HTTP request context (req/res)",
    });
  }
};

export const assertIsAuthed: (
  ctx: TRPCContext
) => asserts ctx is TRPCContextAuthed = (ctx) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }
};
