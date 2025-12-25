import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { fromNodeHeaders } from "better-auth/node";

import { dbUtils } from "@/server";

export const createTRPCContext = async (options?: CreateNextContextOptions) => {
  let authSession = null;
  if (options) {
    authSession = await dbUtils.auth.api.getSession({
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
