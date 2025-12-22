import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, username } from "better-auth/plugins";

// relative paths here because better-auth cli can't recognize TS path aliases
import { db } from "./core";
import { passwordMinLength } from "../../utils/validators/shared/auth";
import { TEXT_LIMITS } from "../../utils/validators/helpers/text";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: passwordMinLength,
    maxPasswordLength: TEXT_LIMITS.title,
  },

  plugins: [anonymous(), username()],
});
