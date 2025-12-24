import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

// relative paths here because this file is used in some cli and they can't recognize TS path aliases
import { isDev } from "./isDev";

type EnvVar = "NODE_ENV";
type EnvRecord = Record<EnvVar, z.ZodType>;

export const requiredWhen = (isRequired: boolean) => {
  let schema = z.string();
  return isRequired ? schema.min(1) : schema.optional();
};

export const required = () => requiredWhen(true);
export const requiredForDev = () => requiredWhen(isDev);
export const requiredForProd = () => requiredWhen(!isDev);

export const domain = () =>
  z.string().regex(z.regexes.domain, {
    message: "Invalid domain",
  });

export const env = createEnv({
  shared: {
    NODE_ENV: z.enum(["development", "production"]),
  } satisfies EnvRecord,
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
});
