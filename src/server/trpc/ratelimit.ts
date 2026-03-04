import { Ratelimit } from "@upstash/ratelimit";
import { TRPCError } from "@trpc/server";
import { type NextApiRequest } from "next";
import { createHmac } from "node:crypto";

import { redis } from "../redis";
import { trpc } from "./core";
import { env } from "../env";
import { isDev } from "@@/scripts/helpers/isDev";
import { getIp } from "./helpers/getClientInfo";

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];
type WindowSpec = { max: number; window: Duration };
type TrpcMiddleware = ReturnType<typeof trpc.middleware>;
type MiddlewareWithSpec<S extends WindowSpec> = TrpcMiddleware & {
  readonly spec: S;
};

const makeRatelimit = (spec: WindowSpec, prefix: string) => {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(spec.max, spec.window),
    prefix,
  });
};

export const hashString = (key: string) => {
  return createHmac("sha256", env.RATELIMIT_IP_SALT!)
    .update(key)
    .digest("base64url");
};

const getHashedIp = (req: NextApiRequest | undefined) => {
  const ip = req?.headers ? getIp(req.headers) : null;
  return hashString(ip || "unknown");
};

const makeRatelimitMiddleware = <S extends WindowSpec>(
  spec: S,
  prefix: string
) => {
  const limiter = makeRatelimit(spec, prefix);

  const middleware = trpc.middleware(async ({ ctx, next }) => {
    const requestId = `ip:${getHashedIp(ctx.req)}`;

    let rateLimitResponse: Awaited<ReturnType<typeof limiter.limit>> | null =
      null;
    try {
      const _rateLimitResponse = await limiter.limit(requestId);
      rateLimitResponse = _rateLimitResponse;
    } catch (err) {
      // for the rare case that the free quota is exceeded
      // I want the app to continue working even when ratelimiter is unavailable
      console.error("Error in ratelimit.ts: ", err);
    }

    if (!isDev && rateLimitResponse && !rateLimitResponse.success) {
      let retryAfterSeconds = 0;
      if (isDev) {
        retryAfterSeconds = Math.max(
          1,
          Math.ceil((rateLimitResponse.reset - Date.now()) / 1000)
        );

        ctx.res?.setHeader?.("Retry-After", String(retryAfterSeconds));
      }

      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many requests. ${isDev ? `Try again in ~${retryAfterSeconds} seconds.` : "Please try again later."}`,
      });
    }

    return next(); // not passing ctx since this middleware doesn't modify it
    // and preserves the narrowed req/res type
  });

  return Object.assign(middleware, { spec });
};

const rateLimits = {
  default: { max: 120, window: "60s" },
  defaultWrite: { max: 50, window: "60s" },

  websockets_token: { max: 15, window: "60s" },

  auth_normal: { max: 15, window: "60s" },
  auth_sensitive: { max: 7, window: "60s" },
  auth_signUp: { max: 3, window: "60s" },
  auth_changeEmail: { max: 2, window: "120s" },
  auth_requestPasswordReset: { max: 2, window: "60s" },
  auth_resetPassword: { max: 7, window: "60s" },
  auth_login: { max: 5, window: "60s" },
  auth_usernameCheck: { max: 15, window: "60s" },
  auth_avatarUpload: { max: 7, window: "120s" },
} as const satisfies Record<string, WindowSpec>;

type RateLimitMiddlewares = {
  [K in keyof typeof rateLimits]: MiddlewareWithSpec<(typeof rateLimits)[K]>;
};

type LimiterKey = keyof typeof rateLimits;

export const rateLimitMiddlewares = (
  Object.keys(rateLimits) as LimiterKey[]
).reduce((result, limiterKey) => {
  return {
    ...result,
    [limiterKey]: makeRatelimitMiddleware(
      rateLimits[limiterKey],
      `rl:${limiterKey}`
    ),
  };
}, {} as RateLimitMiddlewares);
