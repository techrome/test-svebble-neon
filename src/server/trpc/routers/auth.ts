import { fromNodeHeaders } from "better-auth/node";
import { NextApiRequest, NextApiResponse } from "next";

import { router } from "../core";
import { db } from "../../db/core";
import * as schema from "../../db/schema";
import {
  publicProcedure,
  privateProcedure,
  publicProcedureDefaultRateLimit,
} from "../procedures";
import { auth } from "../auth";
import { rateLimitMiddlewares } from "../ratelimit";
import {
  forgotPasswordSchemaForm,
  loginSchemaForm,
  signupSchemaForm,
  zEmail,
  zUsername,
} from "@/utils/validators/shared/auth";
import z from "zod";
import { baseURL } from "../auth";
import { ROUTES } from "@/utils/routes";
import { appendSetCookiesToNextRes } from "../helpers/cookies";
import { generatePlaceholderEmail } from "../helpers/email";
import { oauthDoneStatus } from "@/components/AuthForm/Helpers";
import {
  basicProfileSchemaForm,
  usernameSchemaForm,
} from "@/pages/app/my-profile";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

type HttpCtx = { req: NextApiRequest; res: NextApiResponse };
type AuthCallResult<T> = { headers: Headers; response: T };

const getCookieForwarder = <THttpCtx extends HttpCtx>(ctx: THttpCtx) => {
  const baseOptions = {
    returnHeaders: true,
    headers: fromNodeHeaders(ctx.req.headers),
  } as const satisfies { returnHeaders: boolean; headers: HeadersInit };

  return async <T>(
    betterAuthFunction: (opts: typeof baseOptions) => Promise<AuthCallResult<T>>
  ): Promise<T> => {
    const authResponse = await betterAuthFunction(baseOptions);
    appendSetCookiesToNextRes(ctx.res, authResponse.headers);
    return authResponse.response;
  };
};

export const authRouter = router({
  user: publicProcedureDefaultRateLimit.query(({ ctx }) => ({
    user: ctx.user,
  })),
  signUpCredentials: publicProcedure
    .use(rateLimitMiddlewares.auth_signUp)
    .input(signupSchemaForm)
    .mutation(async ({ ctx, input }) => {
      return getCookieForwarder(ctx)((opts) =>
        auth.api.signUpEmail({
          body: {
            name: input.username,
            username: input.username,
            displayUsername: input.username,
            email: generatePlaceholderEmail(),
            password: input.password,
            pendingEmail: input.email || null,
            pendingEmailSetAt: input.email ? new Date() : null,
          },
          ...opts,
        })
      );
    }),
  changeEmail: privateProcedure
    .use(rateLimitMiddlewares.auth_changeEmail)
    .input(
      z.object({
        email: zEmail,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await getCookieForwarder(ctx)((opts) =>
          auth.api.changeEmail({
            body: {
              newEmail: input.email,
              callbackURL: `${baseURL}/${ROUTES.private_emailVerified}`,
            },
            ...opts,
          })
        );
      } catch (err) {
        // intentionally do nothing so that the user won't know whether
        // the email already exists (prevents email enumeration attacks)
      }
      return { email: input.email };
    }),
  loginAnonymous: publicProcedure
    .use(rateLimitMiddlewares.auth_signUp)
    .mutation(async ({ ctx }) => {
      return getCookieForwarder(ctx)((opts) => auth.api.signInAnonymous(opts));
    }),
  loginCredentials: publicProcedure
    .use(rateLimitMiddlewares.auth_login)
    .input(loginSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const cookieForwarder = getCookieForwarder(ctx);
      if (input.usernameOrEmail.includes("@")) {
        return cookieForwarder((opts) =>
          auth.api.signInEmail({
            body: {
              email: input.usernameOrEmail,
              password: input.password,
              rememberMe: input.rememberMe,
            },
            ...opts,
          })
        );
      } else {
        return cookieForwarder((opts) =>
          auth.api.signInUsername({
            body: {
              username: input.usernameOrEmail,
              password: input.password,
              rememberMe: input.rememberMe,
            },
            ...opts,
          })
        );
      }
    }),
  logout: publicProcedureDefaultRateLimit.mutation(async ({ ctx }) => {
    return getCookieForwarder(ctx)((opts) =>
      auth.api.signOut({
        ...opts,
      })
    );
  }),

  googleLogin: publicProcedure
    .use(rateLimitMiddlewares.auth_login)
    .mutation(async ({ ctx }) => {
      return getCookieForwarder(ctx)((opts) =>
        auth.api.signInSocial({
          body: {
            provider: "google",
            callbackURL: `${baseURL}/${ROUTES.oauthDone}?status=${oauthDoneStatus.success}`,
            errorCallbackURL: `${baseURL}/${ROUTES.oauthDone}?status=${oauthDoneStatus.error}`,
            newUserCallbackURL: `${baseURL}/${ROUTES.oauthDone}?status=${oauthDoneStatus.new_user}`,
          },
          ...opts,
        })
      );
    }),

  requestPasswordReset: publicProcedure
    .use(rateLimitMiddlewares.auth_requestPasswordReset)
    .input(forgotPasswordSchemaForm)
    .mutation(async ({ input }) => {
      try {
        await auth.api.requestPasswordReset({
          body: {
            email: input.email,
            redirectTo: `${baseURL}/${ROUTES.resetPassword}`,
          },
        });
      } catch (err) {
        // intentionally ignoring any error here
      }
      return {
        status: true,
      };
    }),
  checkUsernameAvailability: publicProcedure
    .use(rateLimitMiddlewares.auth_usernameCheck)
    .input(
      z.object({
        username: zUsername,
      })
    )
    .query(async ({ input }) => {
      const response = await auth.api.isUsernameAvailable({
        body: {
          username: input.username,
        },
      });
      return response;
    }),

  updateUserBasicInfo: privateProcedure
    .use(rateLimitMiddlewares.auth_normal)
    .input(basicProfileSchemaForm)
    .mutation(async ({ ctx, input }) => {
      return getCookieForwarder(ctx)((opts) =>
        auth.api.updateUser({
          body: {
            name: input.name,
          },
          ...opts,
        })
      );
    }),
  updateUserUsername: privateProcedure
    .use(rateLimitMiddlewares.auth_normal)
    .input(usernameSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const userRows = await db
        .select({
          username: schema.user.username,
          remainingUsernameChanges: schema.user.remainingUsernameChanges,
        })
        .from(schema.user)
        .where(eq(schema.user.id, ctx.user.id))
        .limit(1);
      const currentUserRow = userRows[0];

      if (!currentUserRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }
      const currentRemainingUsernameChanges =
        currentUserRow.remainingUsernameChanges;

      if (
        !currentRemainingUsernameChanges ||
        currentRemainingUsernameChanges < 1
      ) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "You cannot change your username.",
        });
      }

      if (
        input.username.toLowerCase() === currentUserRow.username?.toLowerCase()
      ) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "New username must be different than your current username.",
        });
      }

      return getCookieForwarder(ctx)((opts) =>
        auth.api.updateUser({
          body: {
            username: input.username,
            hasRandomUsername: false,
            remainingUsernameChanges: Math.max(
              0,
              currentRemainingUsernameChanges - 1
            ),
          },
          ...opts,
        })
      );
    }),
  deleteUser: privateProcedure
    .use(rateLimitMiddlewares.auth_sensitive)
    .mutation(async ({ ctx }) => {
      return getCookieForwarder(ctx)((opts) =>
        auth.api.deleteUser({
          body: {},
          ...opts,
        })
      );
    }),
});
