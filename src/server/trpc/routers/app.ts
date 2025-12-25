import z from "zod";
import { eq, desc } from "drizzle-orm";

import { trpc, dbUtils } from "@/server";
import * as sharedCommentsValidations from "@/utils/validators/shared/comments";
import { authRouter } from "./auth";

const { schema, db } = dbUtils;
const { publicProcedure, router } = trpc;

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
  hello: publicProcedure
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
  globalData: publicProcedure.query(() => ({
    links: ["a1", "a2", "a3"],
  })),
  commentsGet: publicProcedure.query(async () => {
    const comments = await db
      .select()
      .from(schema.commentsSchema)
      .orderBy(desc(schema.commentsSchema.created_at));
    return comments;
  }),
  commentCreateSpam: publicProcedure
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
  commentCreate: publicProcedure
    .input(sharedCommentsValidations.commentsCreate)
    .mutation(async ({ input }) => {
      await db.insert(schema.commentsSchema).values({ text: input.text });
    }),
  commentUpdate: publicProcedure
    .input(sharedCommentsValidations.commentsUpdate)
    .mutation(async ({ input }) => {
      const res = await db
        .update(schema.commentsSchema)
        .set({ text: input.text })
        .where(eq(schema.commentsSchema.id, input.id));
      return res;
    }),
  commentDelete: publicProcedure
    .input(sharedCommentsValidations.commentsDelete)
    .mutation(async ({ input }) => {
      await db
        .delete(schema.commentsSchema)
        .where(eq(schema.commentsSchema.id, input.id));
    }),
  commentsDeleteAll: publicProcedure.mutation(async () => {
    await db.delete(schema.commentsSchema);
  }),
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
