import z from "zod";
import { eq, desc, asc, lt } from "drizzle-orm";

import { db } from "../../db/core";
import * as schema from "../../db/schema";
import { router } from "../core";
import {
  publicProcedureSSRDefaultRateLimit,
  privateProcedureDefaultRateLimit,
} from "../procedures";
import * as sharedMessagesValidations from "@/utils/validators/shared/messages";
import { throwIfZodError } from "../helpers/validate";
import { P } from "@/utils/permissions";
import { after, before, beforeOrEqual } from "../../db/helpers/time";
import { TRPCError } from "@trpc/server";

const alphanumeric =
  "ABCDEFGHIJKL MNOPQRSTUVWXYZ abcdefghijklmnop qrstuvwxyz0123456789 ";
const minLength = 5;
const maxLength = 5;

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

type Message = typeof schema.messages.$inferSelect;

export const messagesRouter = router({
  get: publicProcedureSSRDefaultRateLimit
    .input(sharedMessagesValidations.messagesGetSchemaForm)
    .output(
      z.object({
        items: z.array(z.custom<Message>()),
        returnedDirection:
          sharedMessagesValidations.messagesGetSchemaForm.shape.direction.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rate = 0;
      if (input.cursor) {
        if (input.direction === "backward") {
          if (Math.random() < rate) throw new Error("idk");

          const rows = await db
            .select()
            .from(schema.messages)
            .where(before(schema.messages.id, input.cursor))
            .orderBy(desc(schema.messages.id))
            .limit(input.limit);

          return { items: rows.reverse(), returnedDirection: "backward" };
        }

        if (input.direction === "forward") {
          if (Math.random() < rate) throw new Error("idk");
          const rows = await db
            .select()
            .from(schema.messages)
            .where(after(schema.messages.id, input.cursor))
            .orderBy(asc(schema.messages.id))
            .limit(input.limit);

          return { items: rows, returnedDirection: "forward" };
        }

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cursor requires direction",
        });
      }
      if (input.around) {
        if (Math.random() < rate) throw new Error("idk");
        const sideLimit = input.limit / 2;
        let [prevInclRows, nextRows] = await Promise.all([
          db
            .select()
            .from(schema.messages)
            .where(beforeOrEqual(schema.messages.id, input.around))
            .orderBy(desc(schema.messages.id))
            .limit(sideLimit + 1), // +1 because it includes the target message
          db
            .select()
            .from(schema.messages)
            .where(after(schema.messages.id, input.around))
            .orderBy(asc(schema.messages.id))
            .limit(sideLimit),
        ]);

        if (!prevInclRows.length || prevInclRows[0].id !== input.around) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        prevInclRows.reverse();
        prevInclRows.push(...nextRows);

        return { items: prevInclRows };
      }
      if (Math.random() < rate) throw new Error("idk");
      const rows = await db
        .select()
        .from(schema.messages)
        .orderBy(desc(schema.messages.id))
        .limit(input.limit);

      return { items: rows.reverse(), returnedDirection: "backward" };
    }),
  createSpam: privateProcedureDefaultRateLimit([P.messages.create])
    .input(
      z.object({
        isBulk: z.boolean(),
        count: z.number().min(1).max(200).default(200),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input?.isBulk) {
        let rows: (typeof schema.messages.$inferInsert)[] = [];
        for (let i = 0; i < input.count; i++) {
          rows.push({
            content: `${i + 1} - ${generateRandomText(minLength, maxLength, alphanumeric)}`,
            user_id: ctx.user.id,
          });
        }
        await db.insert(schema.messages).values(rows);
      } else {
        const seed = generateRandomText(minLength, maxLength, alphanumeric);
        for (let i = 0; i < input.count; i++) {
          const randomText = `${i + 1} - ${seed}`;

          await db
            .insert(schema.messages)
            .values({ content: randomText, user_id: ctx.user.id });
        }
      }
    }),
  create: privateProcedureDefaultRateLimit([P.messages.create])
    .input(sharedMessagesValidations.messageCreateSchemaForm)
    .mutation(async ({ input, ctx }) => {
      throwIfZodError(
        sharedMessagesValidations
          .makeMessageCreateSchemaForm(ctx.user.emailVerified)
          .safeParse(input)
      );

      await db
        .insert(schema.messages)
        .values({ content: input.content, user_id: ctx.user.id });
    }),
  update: privateProcedureDefaultRateLimit([P.messages.update])
    .input(sharedMessagesValidations.messageUpdateSchemaForm)
    .mutation(async ({ input, ctx }) => {
      throwIfZodError(
        sharedMessagesValidations
          .makeMessageUpdateSchemaForm(ctx.user.emailVerified)
          .safeParse(input)
      );

      const res = await db
        .update(schema.messages)
        .set({ content: input.content })
        .where(eq(schema.messages.id, input.id));
      return res;
    }),
  delete: privateProcedureDefaultRateLimit([P.messages.delete])
    .input(sharedMessagesValidations.messageDeleteSchemaForm)
    .mutation(async ({ input }) => {
      await db.delete(schema.messages).where(eq(schema.messages.id, input.id));
    }),
  deleteAll: privateProcedureDefaultRateLimit([P.messages.delete]).mutation(
    async () => {
      await db.delete(schema.messages);
    }
  ),
});
