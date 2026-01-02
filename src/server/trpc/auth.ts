import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, username } from "better-auth/plugins";

// relative paths here because better-auth cli can't recognize TS path aliases
import { db } from "../db/core";
import * as authSchema from "../db/schema/auth";
import { passwordMinLength } from "../../utils/validators/shared/auth";
import { TEXT_LIMITS } from "../../utils/validators/helpers/text";
import { env } from "../env";
import { minutes } from "@/utils/cacheTime";

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

export const baseURL = getBaseURL();

export const SOME_AUTH_API_ROUTES = {
  error: "error",
  callback: "callback",
  verifyEmail: "verify-email",
};

type DbUserUpdate = Partial<(typeof authSchema.user)["$inferInsert"]>;

type AdditionalUserFields = Pick<
  DbUserUpdate,
  "pendingEmail" | "pendingEmailSetAt"
>;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { ...authSchema } }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: minutes(5, true),
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: passwordMinLength,
    maxPasswordLength: TEXT_LIMITS.title,
  },

  user: {
    additionalFields: {
      canChangeUsername: { type: "boolean", defaultValue: false },
      pendingEmail: { type: "string", required: false },
      pendingEmailSetAt: { type: "date", required: false },
    },
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
    },
    deleteUser: {
      enabled: true,
    },
  },

  emailVerification: {
    sendOnSignUp: false,

    sendVerificationEmail: async (data) => {
      console.log(`Verify email - to:${data.user.email} url:${data.url}`);
    },
  },

  databaseHooks: {
    user: {
      create: {
        async before(user, context) {
          console.log({ user, context });

          return { data: user };
        },
      },
      update: {
        async before(user, context) {
          let updatedUser = user;

          if (
            context?.path === `/${SOME_AUTH_API_ROUTES.verifyEmail}` &&
            user.emailVerified &&
            user.email
          ) {
            const additionalFields = {
              pendingEmail: null,
              pendingEmailSetAt: null,
            } satisfies AdditionalUserFields;
            updatedUser = {
              ...updatedUser,
              ...additionalFields,
            };
          }

          return { data: updatedUser };
        },
      },
    },
  },

  plugins: [anonymous(), username()],
});
