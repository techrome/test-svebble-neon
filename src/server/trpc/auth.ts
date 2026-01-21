import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, username } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";

// relative paths here because better-auth cli can't recognize TS path aliases
import { db } from "../db/core";
import * as authSchema from "../db/schema/auth";
import { redis } from "../redis/redis";
import { hashString } from "./ratelimit";
import {
  passwordMinLength,
  signupSchemaForm,
} from "../../utils/validators/shared/auth";
import { TEXT_LIMITS } from "../../utils/validators/helpers/text";
import { env } from "../env";
import { days, minutes } from "@/utils/cacheTime";
import { generateRandomUsername } from "./helpers/generateRandomUsername";
import { logger } from "@/utils/logger";
import {
  mergeSetCookiesToHeaders,
  cookieHeaderFromSetCookie,
} from "./helpers/cookies";
import { PLACEHOLDER_EMAIL_DOMAIN } from "@/trpc/helpers/email";

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
  signInAnonymous: "sign-in/anonymous",
  resetPassword: "reset-password",
} as const;

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

const setDbRandomUsername = async (data: {
  name: string;
  userId: string;
  canChangeUsername?: boolean;
}) => {
  await db
    .update(authSchema.user)
    .set({
      username: data.name.toLowerCase(),
      displayUsername: data.name,
      hasRandomUsername: true,
      remainingUsernameChanges: data.canChangeUsername ? 1 : null,
    })
    .where(eq(authSchema.user.id, data.userId));
};

type RateLimitValue = {
  key: string;
  count: number;
  lastRequest: number;
};

const RL_PREFIX = "rl:ba:";
const RL_MAX_TTL_SECONDS = minutes(2, true);

const withPrefix = (key: string) => `${RL_PREFIX}${key}`;

const parseMaybeJson = <T>(value: unknown): T | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
};

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { ...authSchema } }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],

  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: minutes(5, true),
    },
    expiresIn: days(7, true),
    updateAge: days(1, true),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: passwordMinLength,
    maxPasswordLength: TEXT_LIMITS.title,

    sendResetPassword: async (data, request) => {
      console.log("send reset pass", { data, request });
    },
    onPasswordReset: async (data, request) => {
      console.log("on pass reset", { data, request });
    },
  },

  user: {
    additionalFields: {
      remainingUsernameChanges: { type: "number", required: false },
      hasRandomUsername: { type: "boolean", defaultValue: false },
      pendingEmail: { type: "string", required: false },
      pendingEmailSetAt: { type: "date", required: false },
      deletedAt: { type: "date", required: false },
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
    // invalidating cookie cache for routes that modify user but don't automatically refresh the cookie
    after: createAuthMiddleware(async (context) => {
      const allowedRoutes = [
        SOME_AUTH_API_ROUTES.callback,
        SOME_AUTH_API_ROUTES.verifyEmail,
        SOME_AUTH_API_ROUTES.signInAnonymous,
      ];
      if (
        !allowedRoutes.some((path) => context.path.startsWith(`/${path}`)) ||
        !context.context.newSession
      ) {
        return;
      }

      const responseHeaders = context.context.responseHeaders;
      if (!responseHeaders) return;

      const cookieHeader = cookieHeaderFromSetCookie(responseHeaders);
      if (!cookieHeader) return;

      const headers = new Headers(context.headers);
      headers.set("cookie", cookieHeader);

      const refreshedSession = await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
        asResponse: true,
      });

      mergeSetCookiesToHeaders(responseHeaders, refreshedSession.headers);
    }),
  },

  plugins: [
    anonymous({
      emailDomainName: PLACEHOLDER_EMAIL_DOMAIN,
      generateName: () => "Guest",
    }),
    username({
      maxUsernameLength: TEXT_LIMITS.handle,
    }),
  ],
  advanced: {
    database: {
      generateId: "uuid",
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      [`/${SOME_AUTH_API_ROUTES.callback}/*`]: {
        window: 60,
        max: 10,
      },
      [`/${SOME_AUTH_API_ROUTES.verifyEmail}`]: {
        window: 60,
        max: 5,
      },
      [`/${SOME_AUTH_API_ROUTES.resetPassword}/*`]: {
        window: 60,
        max: 5,
      },
    },
    customStorage: {
      get: async (key: string) => {
        const raw = await redis.get(withPrefix(hashString(key)));
        const stored = parseMaybeJson<Omit<RateLimitValue, "key">>(raw);
        if (stored) {
          return {
            key,
            ...stored,
          };
        }
      },
      set: async (key: string, value: RateLimitValue) => {
        const { key: _unusedKey, ...valueToStore } = value;

        // not storing the key prop inside the value directly to avoid IP leaks
        await redis.set(withPrefix(hashString(key)), valueToStore, {
          ex: RL_MAX_TTL_SECONDS,
        });
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async after(user, context) {
          let updatedUser = user as typeof user & AdditionalUserFields;

          const allowedRoutes = [
            SOME_AUTH_API_ROUTES.callback,
            SOME_AUTH_API_ROUTES.signInAnonymous,
          ];
          const isGuest = Boolean(updatedUser.isAnonymous);
          const maxAttempts = 10;

          if (
            !updatedUser.username &&
            allowedRoutes.some((path) => context?.path.startsWith(`/${path}`))
          ) {
            for (let i = 0; i <= maxAttempts; i++) {
              const randomUsername = generateRandomUsername(isGuest);

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
                await setDbRandomUsername({
                  name: randomUsername,
                  userId: updatedUser.id,
                  canChangeUsername: !isGuest,
                });

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

            const fallbackUsername = updatedUser.id
              .replaceAll("-", "")
              .slice(0, TEXT_LIMITS.handle);

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
            await setDbRandomUsername({
              name: fallbackUsername,
              userId: updatedUser.id,
              canChangeUsername: !isGuest,
            });
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
});
