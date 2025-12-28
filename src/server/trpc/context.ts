import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "./auth";

export const createTRPCContext = async (options?: CreateNextContextOptions) => {
  let authSession = null;
  if (options) {
    authSession = await auth.api.getSession({
      headers: fromNodeHeaders(options.req.headers),
    });
  }

  return {
    req: options?.req,
    res: options?.res,

    authSession,
    user: authSession?.user || null,
    session: authSession?.session || null,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

export type TRPCContextWithReqRes = TRPCContext & {
  req: NonNullable<TRPCContext["req"]>;
  res: NonNullable<TRPCContext["res"]>;
};

export type TRPCContextAuthed = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};
