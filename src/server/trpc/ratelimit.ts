import { Ratelimit } from "@upstash/ratelimit";
import { TRPCError } from "@trpc/server";
import { type IncomingMessage } from "node:http";
import { isIP } from "node:net";
import { createHmac } from "node:crypto";

import { redis } from "../redis";
import { trpc } from "./core";
import { env } from "@/server";

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

const getIp = (req: IncomingMessage | undefined): string => {
  if (req) {
    const xff = extractFirstIp(req.headers["x-forwarded-for"]);
    if (isIP(xff)) return xff;

    const xri = extractFirstIp(req.headers["x-real-ip"]);
    if (isIP(xri)) return xri;

    return "unknown-client-ip";
  }

  return "server-side-ip";
};

const getHashedIp = (req: IncomingMessage | undefined): string => {
  const ip = getIp(req);

  return createHmac("sha256", env.RATELIMIT_IP_SALT!)
    .update(ip)
    .digest("base64url");
};

const makeRatelimitMiddleware = (spec: WindowSpec, prefix: string) => {
  const limiter = makeRatelimit(spec, prefix);

  return trpc.middleware(async ({ ctx, next }) => {
    const requestId = ctx.user?.id
      ? `u:${ctx.user.id}`
      : `ip:${getHashedIp(ctx.req)}`;

    const { success, reset } = await limiter.limit(requestId);

    if (!success) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((reset - Date.now()) / 1000)
      );

      ctx.res?.setHeader?.("Retry-After", String(retryAfterSeconds));

      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many requests. Try again in ~${retryAfterSeconds} seconds.`,
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
  auth_login: { max: 5, window: "60s" },
  auth_usernameCheck: { max: 10, window: "60s" },
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
