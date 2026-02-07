import { fromNodeHeaders } from "better-auth/node";
import { NextApiRequest, NextApiResponse } from "next";

import { router } from "../core";
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
} from "@/utils/validators/shared/auth";
import z from "zod";
import { baseURL } from "../auth";
import { ROUTES } from "@/utils/routes";
import { mergeSetCookiesToNextRes } from "../helpers/cookies";
import { generatePlaceholderEmail } from "../helpers/email";
import { oauthDoneStatus } from "@/components/AuthForm/Helpers";
import { TRPCError } from "@trpc/server";
import { resetPasswordSchemaForm } from "@/pages/auth/reset-password";

type HttpCtx = { req: NextApiRequest; res: NextApiResponse };
export type AuthCallResult<T> = { headers: Headers; response: T };

export const getCookieForwarder = <THttpCtx extends HttpCtx>(ctx: THttpCtx) => {
  const baseOptions = {
    returnHeaders: true,
    headers: fromNodeHeaders(ctx.req.headers),
  } as const satisfies { returnHeaders: boolean; headers: HeadersInit };

  return async <T>(
    betterAuthFunction: (opts: typeof baseOptions) => Promise<AuthCallResult<T>>
  ): Promise<T> => {
    const authResponse = await betterAuthFunction(baseOptions);
    mergeSetCookiesToNextRes(ctx.res, authResponse.headers);
    return authResponse.response;
  };
};

export const authRouter = router({
  user: publicProcedureDefaultRateLimit.query(async ({ ctx }) => {
    const authResponse = await ctx.getCachedAuth();

    return {
      user: authResponse?.response?.user,
    };
  }),
  freshUser: privateProcedure([])
    .use(rateLimitMiddlewares.auth_sensitive)
    .query(async ({ ctx }) => {
      return {
        user: ctx.user,
      };
    }),
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
      } catch (_err) {
        // intentionally ignoring any error here
      }
      return {
        status: true,
      };
    }),
  resetPassword: publicProcedure
    .use(rateLimitMiddlewares.auth_resetPassword)
    .input(resetPasswordSchemaForm)
    .mutation(async ({ input }) => {
      const res = await auth.api.resetPassword({
        body: {
          newPassword: input.password,
          token: input.token,
        },
      });

      return res;
    }),
});
