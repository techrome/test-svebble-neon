import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, username } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";

// relative paths here because better-auth cli can't recognize TS path aliases
import { db } from "../db/core";
import * as authSchema from "../db/schema/auth";
import {
  passwordMinLength,
  signupSchemaForm,
} from "../../utils/validators/shared/auth";
import { TEXT_LIMITS } from "../../utils/validators/helpers/text";
import { env } from "../env";
import { minutes } from "@/utils/cacheTime";
import { generateRandomUsername } from "./helpers/generateRandomUsername";
import { logger } from "@/utils/logger";
import {
  appendSetCookiesToHeaders,
  cookieHeaderFromSetCookie,
} from "./helpers/cookies";

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
  | "pendingEmail"
  | "pendingEmailSetAt"
  | "username"
  | "displayUsername"
  | "isAnonymous"
  | "hasRandomUsername"
  | "remainingUsernameChanges"
>;

const setDbRandomUsername = async (name: string, userId: string) => {
  await db
    .update(authSchema.user)
    .set({
      username: name,
      hasRandomUsername: true,
      remainingUsernameChanges: 1,
    })
    .where(eq(authSchema.user.id, userId));
};

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
      remainingUsernameChanges: { type: "number", defaultValue: 0 },
      hasRandomUsername: { type: "boolean", defaultValue: false },
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

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const allowedRoutes = [
        SOME_AUTH_API_ROUTES.callback,
        SOME_AUTH_API_ROUTES.verifyEmail,
      ];
      if (!allowedRoutes.some((path) => ctx.path.startsWith(`/${path}`)))
        return;
      if (!ctx.context.newSession) return;

      const responseHeaders = ctx.context.responseHeaders;
      if (!responseHeaders) return;

      const cookieHeader = cookieHeaderFromSetCookie(responseHeaders);
      if (!cookieHeader) return;

      const headers = new Headers(ctx.headers);
      headers.set("cookie", cookieHeader);

      const refreshedSession = await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
        asResponse: true,
      });

      appendSetCookiesToHeaders(responseHeaders, refreshedSession.headers);
    }),
  },
  databaseHooks: {
    user: {
      create: {
        async after(user, context) {
          let updatedUser = user as typeof user & AdditionalUserFields;

          const maxAttempts = 10;
          if (
            !updatedUser.username &&
            context?.path.startsWith(`/${SOME_AUTH_API_ROUTES.callback}`)
          ) {
            for (let i = 0; i <= maxAttempts; i++) {
              const randomUsername = generateRandomUsername().toLowerCase();

              if (
                !signupSchemaForm.shape.username.safeParse(randomUsername)
                  .success
              ) {
                logger.error(
                  "Error when validating random username, value was: ",
                  randomUsername
                );
                continue;
              }
              try {
                await setDbRandomUsername(randomUsername, updatedUser.id);

                return;
              } catch (err) {
                const uniqueConstraintErrorCode = "23505";
                if (
                  (err as { code?: string })?.code === uniqueConstraintErrorCode
                ) {
                  continue;
                } else {
                  logger.error("Error when creating a random username: ", err);
                  throw err;
                }
              }
            }

            const fallbackUsername = updatedUser.id.toLowerCase();

            if (
              !signupSchemaForm.shape.username.safeParse(fallbackUsername)
                .success
            ) {
              logger.error(
                "Error when validating fallback username, value was: ",
                fallbackUsername
              );
              return;
            }
            await setDbRandomUsername(fallbackUsername, updatedUser.id);
          }
        },
      },
      update: {
        async before(user, context) {
          let updatedUser = user;

          if (
            context?.path.startsWith(`/${SOME_AUTH_API_ROUTES.verifyEmail}`) &&
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

  plugins: [
    anonymous(),
    username({
      maxUsernameLength: TEXT_LIMITS.handle,
    }),
  ],
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
