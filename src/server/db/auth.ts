import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, username } from "better-auth/plugins";

// relative paths here because better-auth cli can't recognize TS path aliases
import { db } from "./core";
import { passwordMinLength } from "../../utils/validators/shared/auth";
import { TEXT_LIMITS } from "../../utils/validators/helpers/text";
import { env } from "../env";

const getBaseURL = () => {
  if (env.BASE_URL) {
    return `${env.BASE_URL}`;
  }
  const vercelUrl = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
};

const baseURL = getBaseURL();

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: passwordMinLength,
    maxPasswordLength: TEXT_LIMITS.title,
  },

  plugins: [anonymous(), username()],
});
