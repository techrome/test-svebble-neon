import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

// relative paths here because this file is used in some cli and they can't recognize TS path aliases
import { isDev } from "../../scripts/helpers/isDev";
import {
  ClientEnvVar,
  domain,
  required,
  requiredForDev,
  requiredForProd,
  url,
} from "@/utils/env";

type EnvVar =
  | "POSTGRES_USER"
  | "POSTGRES_PASSWORD"
  | "POSTGRES_DB"
  | "PGADMIN_DEFAULT_EMAIL"
  | "PGADMIN_DEFAULT_PASSWORD"
  | "DATABASE_URL_DOMAIN"
  | "DATABASE_URL_PORT"
  | "DATABASE_URL"
  | "APPLICATION_NAME"
  | "DATABASE_URL_UNPOOLED"
  | "SENTRY_AUTH_TOKEN"
  | "BETTER_AUTH_SECRET"
  | "BASE_URL"
  | "VERCEL"
  | "VERCEL_ENV"
  | "VERCEL_URL"
  | "VERCEL_PROJECT_PRODUCTION_URL"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "UPSTASH_REDIS_REST_TOKEN"
  | "UPSTASH_REDIS_REST_URL"
  | "RATELIMIT_IP_SALT"
  | "BACKBLAZE_APP_KEY"
  | "BACKBLAZE_APP_KEY_ID"
  | "BACKBLAZE_BUCKET_NAME"
  | "BACKBLAZE_REGION"
  | "BACKBLAZE_ENDPOINT";

type EnvRecord = Record<EnvVar, z.ZodType>;
type ClientEnvRecord = Omit<Record<ClientEnvVar, z.ZodType>, "NODE_ENV">;

export const env = createEnv({
  server: {
    // dev
    POSTGRES_USER: requiredForDev(),
    POSTGRES_PASSWORD: requiredForDev(),
    POSTGRES_DB: requiredForDev(),
    DATABASE_URL_DOMAIN: requiredForDev(),
    DATABASE_URL_PORT: requiredForDev(),
    PGADMIN_DEFAULT_EMAIL: z.email().optional(),
    PGADMIN_DEFAULT_PASSWORD: z.string().optional(),
    APPLICATION_NAME: z.string().optional(),

    // prod
    DATABASE_URL: z.string().optional(),
    DATABASE_URL_UNPOOLED: z.string().optional(),
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.enum(["development", "production", "preview"]).optional(),
    VERCEL_URL: domain(false),
    VERCEL_PROJECT_PRODUCTION_URL: domain(false),
    BACKBLAZE_APP_KEY: requiredForProd(),
    BACKBLAZE_APP_KEY_ID: requiredForProd(),
    BACKBLAZE_BUCKET_NAME: requiredForProd(),
    BACKBLAZE_ENDPOINT: url(!isDev),
    BACKBLAZE_REGION: requiredForProd(),

    // common
    BASE_URL: z.url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    BETTER_AUTH_SECRET: required(),
    GOOGLE_CLIENT_ID: required(),
    GOOGLE_CLIENT_SECRET: required(),
    UPSTASH_REDIS_REST_TOKEN: required(),
    UPSTASH_REDIS_REST_URL: z.url(),
    RATELIMIT_IP_SALT: required(),
  } satisfies EnvRecord,
  shared: {
    NEXT_PUBLIC_CDN_URL: url(!isDev),
  } satisfies ClientEnvRecord,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  },
  emptyStringAsUndefined: true,
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((all, ctx) => {
      // if we are on prod and no prod db url was provided, make the dev db vars required
      if (!isDev && !all.DATABASE_URL) {
        (
          [
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
            "POSTGRES_DB",
            "DATABASE_URL_DOMAIN",
            "DATABASE_URL_PORT",
          ] satisfies EnvVar[]
        ).forEach((envVarName) => {
          if (!all[envVarName]) {
            ctx.addIssue({
              code: "custom",
              path: [envVarName],
              message: `In production, ${envVarName} is required if DATABASE_URL wasn't provided`,
            });
          }
        });
      }

      if (
        !isDev &&
        !all.BASE_URL &&
        !all.VERCEL_PROJECT_PRODUCTION_URL &&
        !all.VERCEL_URL
      ) {
        ctx.addIssue({
          code: "custom",
          message: `In production, you must set either of these: BASE_URL, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL`,
        });
      }
    }),
});
