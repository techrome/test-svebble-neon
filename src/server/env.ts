import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

// relative paths here because this file is used in some cli and they can't recognize TS path aliases
import { isDev } from "../../scripts/helpers/isDev";
import { required, requiredForDev } from "../utils/env";

type EnvVar =
  | "POSTGRES_USER"
  | "POSTGRES_PASSWORD"
  | "POSTGRES_DB"
  | "PGADMIN_DEFAULT_EMAIL"
  | "PGADMIN_DEFAULT_PASSWORD"
  | "DATABASE_URL_DOMAIN"
  | "DATABASE_URL_PORT"
  | "DATABASE_URL"
  | "DATABASE_URL_UNPOOLED"
  | "SENTRY_AUTH_TOKEN"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL";

type EnvRecord = Record<EnvVar, z.ZodType>;

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

    // prod
    DATABASE_URL: z.string().optional(),
    DATABASE_URL_UNPOOLED: z.string().optional(),

    // common
    SENTRY_AUTH_TOKEN: z.string().optional(),
    BETTER_AUTH_SECRET: required(),
    BETTER_AUTH_URL: required(),
  } satisfies EnvRecord,
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
    }),
});
