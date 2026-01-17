import {
  NextApiRequest,
  type CreateNextContextOptions,
} from "@trpc/server/adapters/next";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "./auth";
import { mergeSetCookiesToNextRes } from "./helpers/cookies";
import { type AuthCallResult } from "./routers/auth";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

const getSessionWrapper = (req: NextApiRequest, needsCached: boolean) => {
  const headers = fromNodeHeaders(req.headers);

  return auth.api.getSession({
    ...(needsCached ? {} : { query: { disableCookieCache: true } }),
    headers,
    returnHeaders: true,
  });
};

export const createTRPCContext = async (options?: CreateNextContextOptions) => {
  type GetAuthReturn = Promise<AuthCallResult<AuthSession> | null>;

  let cachedAuthPromise: GetAuthReturn | null = null;
  let authPromise: GetAuthReturn | null = null;

  const getAuth = async (opts?: { cached?: boolean }): GetAuthReturn => {
    if (!options?.req || !options?.res) return null;
    const { req, res } = options;
    const needsCached = Boolean(opts?.cached);

    const mergeSetCookiesAndGetData = (
      result: Awaited<ReturnType<typeof getSessionWrapper>>
    ) => {
      mergeSetCookiesToNextRes(res, result.headers);
      return result;
    };

    if (needsCached) {
      if (!cachedAuthPromise) {
        cachedAuthPromise = getSessionWrapper(req, true).then(
          mergeSetCookiesAndGetData
        );
      }
      return cachedAuthPromise;
    } else {
      if (!authPromise) {
        authPromise = getSessionWrapper(req, false).then(
          mergeSetCookiesAndGetData
        );
        cachedAuthPromise = authPromise;
      }
      return authPromise;
    }
  };

  return {
    req: options?.req,
    res: options?.res,

    getCachedAuth: () => getAuth({ cached: true }),
    getAuth: () => getAuth(),
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

export type TRPCContextWithReqRes = TRPCContext & {
  req: NonNullable<TRPCContext["req"]>;
  res: NonNullable<TRPCContext["res"]>;
};
