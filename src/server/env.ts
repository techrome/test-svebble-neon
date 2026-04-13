import { createEnv } from "@t3-oss/env-nextjs";
import z from "@/utils/zod";

// relative paths here because this file is used in some cli and they can't recognize TS path aliases
import { isDev } from "../../scripts/helpers/isDev";
import {
  domain,
  required,
  requiredForDev,
  requiredForProd,
  ignoreForGithubActions,
} from "@/utils/env";

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
    OPENAI_API_TOKEN: ignoreForGithubActions(requiredForProd()),
    WEBSOCKETS_API_KEY: ignoreForGithubActions(requiredForProd()),

    // common
    BASE_URL: z.url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    BETTER_AUTH_SECRET: ignoreForGithubActions(required()),
    GOOGLE_CLIENT_ID: ignoreForGithubActions(required()),
    GOOGLE_CLIENT_SECRET: ignoreForGithubActions(required()),
    UPSTASH_REDIS_REST_TOKEN: ignoreForGithubActions(required()),
    UPSTASH_REDIS_REST_URL: ignoreForGithubActions(z.url()),
    RATELIMIT_IP_SALT: ignoreForGithubActions(required()),
    BACKBLAZE_APP_KEY: ignoreForGithubActions(required()),
    BACKBLAZE_APP_KEY_ID: ignoreForGithubActions(required()),
    BACKBLAZE_BUCKET_NAME: ignoreForGithubActions(required()),
    BACKBLAZE_ENDPOINT: ignoreForGithubActions(z.url()),
    BACKBLAZE_REGION: ignoreForGithubActions(required()),
    CRON_SECRET: ignoreForGithubActions(required()),
    EMAIL_SMTP_HOST: ignoreForGithubActions(required()),
    EMAIL_SMTP_PORT: ignoreForGithubActions(required()),
    EMAIL_SMTP_USER: ignoreForGithubActions(required()),
    EMAIL_SMTP_PASS: ignoreForGithubActions(required()),
    EMAIL_FROM: ignoreForGithubActions(required()),
    ENCRYPTION_PUBLIC_KEY: ignoreForGithubActions(required()),
  },
  experimental__runtimeEnv: {},
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
          ] satisfies (keyof typeof all)[]
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
