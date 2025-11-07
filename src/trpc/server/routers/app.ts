import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { procedure, router } from "@/trpc/server";
import * as schema from "@/db/schema";
import * as sharedCommentsValidations from "@/utils/validators/shared/comments";
import { db } from "@/db";

export const appRouter = router({
  hello: procedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
  globalData: procedure.query(() => ({
    links: ["a1", "a2", "a3"],
  })),
  commentsGet: procedure.query(async () => {
    const comments = await db
      .select()
      .from(schema.commentsSchema)
      .orderBy(desc(schema.commentsSchema.created_at));
    return comments;
  }),
  commentCreate: procedure
    .input(sharedCommentsValidations.commentsCreate)
    .mutation(async ({ input }) => {
      const res = await db
        .insert(schema.commentsSchema)
        .values({ text: input.text });
      return res;
    }),
  commentUpdate: procedure
    .input(sharedCommentsValidations.commentsUpdate)
    .mutation(async ({ input }) => {
      const res = await db
        .update(schema.commentsSchema)
        .set({ text: input.text })
        .where(eq(schema.commentsSchema.id, input.id));
      return res;
    }),
  commentDelete: procedure
    .input(sharedCommentsValidations.commentsDelete)
    .mutation(async ({ input }) => {
      await db
        .delete(schema.commentsSchema)
        .where(eq(schema.commentsSchema.id, input.id));
    }),
  commentsDeleteAll: procedure.mutation(async () => {
    await db.delete(schema.commentsSchema);
  }),
});

export type AppRouter = typeof appRouter;
