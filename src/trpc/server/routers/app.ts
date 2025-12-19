import z from "zod";
import { eq, desc } from "drizzle-orm";

import { procedure, router } from "@/trpc/server";
import * as schema from "@/db/schema";
import * as sharedCommentsValidations from "@/utils/validators/shared/comments";
import { db } from "@/db";

const alphanumeric =
  "ABCDEFGHIJKL MNOPQRSTUVWXYZ abcdefghijklmnop qrstuvwxyz0123456789 ";
const minLength = 5;
const maxLength = 254;

const getRandomInt = (min: number, max: number) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomCharacter = (characters: string) => {
  return characters.charAt(Math.floor(Math.random() * characters.length));
};

const generateRandomText = (
  minLength: number,
  maxLength: number,
  characterSet: string
) => {
  const length = getRandomInt(minLength, maxLength);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += getRandomCharacter(characterSet);
  }
  return result;
};
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
  commentCreateSpam: procedure
    .input(
      z
        .object({
          isBulk: z.boolean(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      if (input?.isBulk) {
        let rows: { text: string }[] = [];
        for (let i = 0; i < 200; i++) {
          rows.push({
            text: generateRandomText(minLength, maxLength, alphanumeric),
          });
        }
        await db.insert(schema.commentsSchema).values(rows);
      } else {
        for (let i = 0; i < 200; i++) {
          const randomText = generateRandomText(
            minLength,
            maxLength,
            alphanumeric
          );

          await db.insert(schema.commentsSchema).values({ text: randomText });
        }
      }
    }),
  commentCreate: procedure
    .input(sharedCommentsValidations.commentsCreate)
    .mutation(async ({ input }) => {
      await db.insert(schema.commentsSchema).values({ text: input.text });
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
