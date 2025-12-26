import z from "zod";
import { eq, desc } from "drizzle-orm";

import { trpc, dbUtils } from "@/server";
import * as sharedCommentsValidations from "@/utils/validators/shared/comments";
import { signupSchemaForm } from "@/utils/validators/shared/auth";
import { fromNodeHeaders } from "better-auth/node";

const { schema, db } = dbUtils;
const { publicProcedure, publicProcedureHttp, router, auth } = trpc;

export const authRouter = router({
  //   commentsGet: publicProcedure.query(async () => {
  //     const comments = await db
  //       .select()
  //       .from(schema.commentsSchema)
  //       .orderBy(desc(schema.commentsSchema.created_at));
  //     return comments;
  //   }),
  //   commentCreate: publicProcedure
  //     .input(sharedCommentsValidations.commentsCreate)
  //     .mutation(async ({ input }) => {
  //       await db.insert(schema.commentsSchema).values({ text: input.text });
  //     }),

  session: publicProcedure.query(({ ctx }) => ctx.session),

  signUpUsername: publicProcedureHttp
    .input(signupSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const { headers, response } = await auth.api.signUpEmail({
        returnHeaders: true,
        headers: fromNodeHeaders(ctx.req.headers),
        body: {
          name: input.username,
          email: input.email || `${input.username}@tmpmail-svebble.com`,
          password: input.password,
        },
      });

      console.log({ ctx, headers, response });

      return response;
    }),
});
