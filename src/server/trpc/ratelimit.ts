import { Ratelimit } from "@upstash/ratelimit";
import { TRPCError } from "@trpc/server";
import { type IncomingMessage } from "node:http";
import { isIP } from "node:net";
import { createHmac } from "node:crypto";

import { redis } from "../redis";
import { trpc } from "./core";
import { env } from "../env";
import { logger } from "@/utils/logger";
import { isDev } from "@@/scripts/helpers/isDev";

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];

type WindowSpec = { max: number; window: Duration };

const makeRatelimit = (spec: WindowSpec, prefix: string) => {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(spec.max, spec.window),
    prefix,
  });
};

const extractFirstIp = (header: string | string[] | undefined) =>
  typeof header === "string"
    ? header.split(",")[0].trim()
    : Array.isArray(header)
      ? header[0].trim()
      : "";

const getIp = (req: IncomingMessage | undefined) => {
  if (req) {
    const xff = extractFirstIp(req.headers["x-forwarded-for"]);
    if (isIP(xff)) return xff;

    const xri = extractFirstIp(req.headers["x-real-ip"]);
    if (isIP(xri)) return xri;

    return "unknown-client-ip";
  }

  return "server-side-ip";
};

export const hashString = (key: string) => {
  return createHmac("sha256", env.RATELIMIT_IP_SALT!)
    .update(key)
    .digest("base64url");
};

const getHashedIp = (req: IncomingMessage | undefined) => {
  const ip = getIp(req);
  return hashString(ip);
};

const makeRatelimitMiddleware = (spec: WindowSpec, prefix: string) => {
  const limiter = makeRatelimit(spec, prefix);

  return trpc.middleware(async ({ ctx, next }) => {
    const requestId = ctx.user?.id
      ? `u:${ctx.user.id}`
      : `ip:${getHashedIp(ctx.req)}`;

    let rateLimitResponse: Awaited<ReturnType<typeof limiter.limit>> | null =
      null;
    try {
      const _rateLimitResponse = await limiter.limit(requestId);
      rateLimitResponse = _rateLimitResponse;
    } catch (err) {
      // for the rare case that the free quota is exceeded
      // I want the app to continue working even when ratelimiter is unavailable
      logger.error("Error in ratelimit.ts: ", err);
    }

    if (rateLimitResponse && !rateLimitResponse.success) {
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
};

const rateLimits = {
  default: { max: 120, window: "60s" },
  defaultWrite: { max: 50, window: "60s" },

  auth_normal: { max: 15, window: "60s" },
  auth_sensitive: { max: 7, window: "60s" },
  auth_signUp: { max: 3, window: "60s" },
  auth_changeEmail: { max: 2, window: "60s" },
  auth_requestPasswordReset: { max: 2, window: "60s" },
  auth_login: { max: 5, window: "60s" },
  auth_usernameCheck: { max: 15, window: "60s" },
} as const satisfies Record<string, WindowSpec>;

type LimiterKey = keyof typeof rateLimits;

export const rateLimitMiddlewares = (
  Object.keys(rateLimits) as LimiterKey[]
).reduce(
  (result, limiterKey) => {
    return {
      ...result,
      [limiterKey]: makeRatelimitMiddleware(
        rateLimits[limiterKey],
        `rl:${limiterKey}`
      ),
    };
  },
  {} as Record<LimiterKey, ReturnType<typeof makeRatelimitMiddleware>>
);
