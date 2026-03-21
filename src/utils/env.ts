import { createEnv } from "@t3-oss/env-nextjs";
import z from "@/utils/zod";

// relative paths here because this file is used in some cli and they can't recognize TS path aliases
import { isDev } from "./isDev";

export const requiredWhen = (isRequired: boolean) => {
  let schema = z.string();
  return isRequired ? schema.min(1) : schema.optional();
};

export const required = () => requiredWhen(true);
export const requiredForDev = () => requiredWhen(isDev);
export const requiredForProd = () => requiredWhen(!isDev);

export const domain = (required: boolean) => {
  if (required) {
    return z.string().regex(z.regexes.domain, {
      message: "Invalid domain",
    });
  } else {
    return z.string().optional();
  }
};
export const url = (required: boolean) => {
  if (required) {
    return z.url();
  } else {
    return z.url().optional();
  }
};

export const env = createEnv({
  shared: {
    NODE_ENV: z.enum(["development", "production"]),
    NEXT_PUBLIC_CDN_URL: url(!isDev),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  },
  emptyStringAsUndefined: true,
});
