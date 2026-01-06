import { fromNodeHeaders } from "better-auth/node";
import { NextApiRequest, NextApiResponse } from "next";

import { trpc } from "@/server";
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

const {
  publicProcedureHttp,
  privateProcedureHttp,
  publicProcedureHttpDefaultRateLimit,
  router,
  auth,
  rateLimitMiddlewares,
} = trpc;

type HttpCtx = { req: NextApiRequest; res: NextApiResponse };

const getAuthHelpers = <THttpCtx extends HttpCtx>(ctx: THttpCtx) => {
  const options = {
    returnHeaders: true,
    headers: fromNodeHeaders(ctx.req.headers),
  } satisfies { returnHeaders: boolean; headers: HeadersInit };

  const responseHandler = <TAuthResponse>(authResponse: {
    headers: Headers;
    response: TAuthResponse;
  }) => {
    appendSetCookiesToNextRes(ctx.res, authResponse.headers);
    return authResponse.response;
  };

  return {
    options,
    responseHandler,
  };
};

export const authRouter = router({
  user: publicProcedureHttpDefaultRateLimit.query(({ ctx }) => ({
    user: ctx.user,
  })),
  signUpCredentials: publicProcedureHttp
    .use(rateLimitMiddlewares.auth_signUp)
    .input(signupSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const { options, responseHandler } = getAuthHelpers(ctx);
      const authResponse = await auth.api.signUpEmail({
        body: {
          name: input.username,
          username: input.username,
          displayUsername: input.username,
          email: generatePlaceholderEmail(),
          password: input.password,
          pendingEmail: input.email || null,
          pendingEmailSetAt: input.email ? new Date() : null,
        },
        ...options,
      });

      return responseHandler(authResponse);
    }),
  changeEmail: privateProcedureHttp
    .use(rateLimitMiddlewares.auth_changeEmail)
    .input(
      z.object({
        email: zEmail,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { options } = getAuthHelpers(ctx);
        await auth.api.changeEmail({
          body: {
            newEmail: input.email,
            callbackURL: `${baseURL}/${ROUTES.private_emailVerified}`,
          },
          ...options,
        });
      } catch (err) {
        // intentionally do nothing so that the user won't know whether
        // the email already exists (prevents email enumeration attacks)
      }
      return { email: input.email };
    }),
  loginAnonymous: publicProcedureHttp
    .use(rateLimitMiddlewares.auth_signUp)
    .mutation(async ({ ctx }) => {
      const { options, responseHandler } = getAuthHelpers(ctx);

      const authResponse = await auth.api.signInAnonymous({
        ...options,
      });
      return responseHandler(authResponse);
    }),
  loginCredentials: publicProcedureHttp
    .use(rateLimitMiddlewares.auth_login)
    .input(loginSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const { options } = getAuthHelpers(ctx);
      let authResponse;
      if (input.usernameOrEmail.includes("@")) {
        authResponse = await auth.api.signInEmail({
          body: {
            email: input.usernameOrEmail,
            password: input.password,
            rememberMe: input.rememberMe,
          },
          ...options,
        });
      } else {
        authResponse = await auth.api.signInUsername({
          body: {
            username: input.usernameOrEmail,
            password: input.password,
            rememberMe: input.rememberMe,
          },
          ...options,
        });
      }

      appendSetCookiesToNextRes(ctx.res, authResponse.headers);
      return authResponse.response;
    }),
  logout: publicProcedureHttpDefaultRateLimit.mutation(async ({ ctx }) => {
    const { options, responseHandler } = getAuthHelpers(ctx);
    const authResponse = await auth.api.signOut({
      ...options,
    });

    return responseHandler(authResponse);
  }),

  googleLogin: publicProcedureHttp
    .use(rateLimitMiddlewares.auth_login)
    .mutation(async ({ ctx }) => {
      const { options, responseHandler } = getAuthHelpers(ctx);

      const authResponse = await auth.api.signInSocial({
        body: {
          provider: "google",
        },
        ...options,
      });
      return responseHandler(authResponse);
    }),

  requestPasswordReset: publicProcedureHttp
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
  checkUsernameAvailability: publicProcedureHttp
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

  deleteUser: privateProcedureHttp
    .use(rateLimitMiddlewares.auth_sensitive)
    .mutation(async ({ ctx }) => {
      const helpers = getAuthHelpers(ctx);
      const authResponse = await auth.api.deleteUser({
        body: {},
        ...helpers.options,
      });

      return helpers.responseHandler(authResponse);
    }),
});
