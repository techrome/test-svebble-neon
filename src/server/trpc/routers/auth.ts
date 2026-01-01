import { fromNodeHeaders } from "better-auth/node";
import { randomUUID } from "node:crypto";
import { NextApiRequest, NextApiResponse } from "next";

import { trpc } from "@/server";
import {
  loginSchemaForm,
  signupSchemaForm,
  zEmail,
  zUsername,
} from "@/utils/validators/shared/auth";
import { forwardSetCookie } from "../helpers/forwardSetCookie";
import z from "zod";
import { baseURL } from "../auth";
import { ROUTES } from "@/utils/routes";

const { publicProcedureHttp, privateProcedureHttp, router, auth } = trpc;

const PLACEHOLDER_EMAIL_DOMAIN = "noemail.invalid";

const generatePlaceholderEmail = () => {
  return `u-${randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
};

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
    forwardSetCookie(authResponse.headers, ctx.res);
    return authResponse.response;
  };

  return {
    options,
    responseHandler,
  };
};

export const authRouter = router({
  user: publicProcedureHttp.query(({ ctx }) => ({
    user: ctx.user,
  })),
  forceRefreshSession: publicProcedureHttp.mutation(async ({ ctx }) => {
    const { options, responseHandler } = getAuthHelpers(ctx);
    let _authResponse = await auth.api.getSession({
      query: { disableCookieCache: true },
      ...options,
    });

    const authResponse = {
      ..._authResponse,
      response: {
        user: _authResponse.response?.user, // removing session object for now
      },
    };

    return responseHandler(authResponse);
  }),

  signUpCredentials: publicProcedureHttp
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
  loginCredentials: publicProcedureHttp
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

      forwardSetCookie(authResponse.headers, ctx.res);
      return authResponse.response;
    }),
  logout: publicProcedureHttp.mutation(async ({ ctx }) => {
    const { options, responseHandler } = getAuthHelpers(ctx);
    const authResponse = await auth.api.signOut({
      ...options,
    });

    return responseHandler(authResponse);
  }),

  googleLogin: publicProcedureHttp.mutation(async ({ ctx }) => {
    const { options, responseHandler } = getAuthHelpers(ctx);

    const authResponse = await auth.api.signInSocial({
      body: {
        provider: "google",
      },
      ...options,
    });
    return responseHandler(authResponse);
  }),

  checkUsernameAvailability: publicProcedureHttp
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

  deleteUser: privateProcedureHttp.mutation(async ({ ctx }) => {
    const helpers = getAuthHelpers(ctx);
    const authResponse = await auth.api.deleteUser({
      body: {},
      ...helpers.options,
    });

    return helpers.responseHandler(authResponse);
  }),
});
