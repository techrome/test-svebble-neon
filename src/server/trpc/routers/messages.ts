import z from "zod";
import { eq, desc, asc, lt, or, and, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "../../db/core";
import * as schema from "../../db/schema";
import { router } from "../core";
import {
  publicProcedureSSRDefaultRateLimit,
  privateProcedureDefaultRateLimit,
  publicProcedure,
} from "../procedures";
import * as sharedMessagesValidations from "@/utils/validators/shared/messages";
import { throwIfZodError } from "../helpers/validate";
import { P } from "@/utils/permissions";
import { after, before, beforeOrEqual } from "../../db/helpers/time";
import { TRPCError } from "@trpc/server";
import { unionAll } from "drizzle-orm/pg-core";
import {
  createChannelSubscribeTokenRequest,
  publishChannelEvent,
} from "../../websockets/core";
import { waitUntil } from "@vercel/functions";
import { rateLimitMiddlewares } from "../ratelimit";
import { numericIdSchema } from "@/utils/validators/helpers/custom";

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
  ablyTokenRequest: publicProcedure
    .use(rateLimitMiddlewares.websockets_token)
    .input(sharedMessagesValidations.messagesGetWebsocketsToken)
    .mutation(async ({ ctx, input }) => {
      const userId = `tmp-${randomUUID()}`;
      return createChannelSubscribeTokenRequest({
        userId,
        channelId: String(input.channelId),
      });
    }),
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
      const cursor = input.cursor;
      //await new Promise((r) => setTimeout(r, 500));
      if (cursor) {
        if (cursor.direction && cursor.id) {
          if (cursor.direction === "backward") {
            if (Math.random() < rate) throw new Error("idk");

            const rows = await db
              .select()
              .from(schema.messages)
              .where(
                and(
                  eq(schema.messages.channel_id, input.channelId),
                  isNull(schema.messages.deleted_at),
                  before(schema.messages.id, cursor.id)
                )
              )
              .orderBy(desc(schema.messages.id))
              .limit(input.limit);

            return { items: rows.reverse(), returnedDirection: "backward" };
          }

          if (cursor.direction === "forward") {
            if (Math.random() < rate) throw new Error("idk");
            const rows = await db
              .select()
              .from(schema.messages)
              .where(
                and(
                  eq(schema.messages.channel_id, input.channelId),
                  isNull(schema.messages.deleted_at),
                  after(schema.messages.id, cursor.id)
                )
              )
              .orderBy(asc(schema.messages.id))
              .limit(input.limit);

            return { items: rows, returnedDirection: "forward" };
          }
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cursor requires id and direction",
        });
      }
      if (input.around) {
        if (Math.random() < rate) throw new Error("idk");
        const sideLimit = input.limit / 2;

        const prevIncl = db
          .select()
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.channel_id, input.channelId),
              isNull(schema.messages.deleted_at),
              beforeOrEqual(schema.messages.id, input.around)
            )
          )
          .orderBy(desc(schema.messages.id))
          .limit(sideLimit + 1) // +1 because it includes the target message
          .as("prevIncl");

        const next = db
          .select()
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.channel_id, input.channelId),
              isNull(schema.messages.deleted_at),
              after(schema.messages.id, input.around)
            )
          )
          .orderBy(asc(schema.messages.id))
          .limit(sideLimit)
          .as("next");

        // using union to make it a single db call and avoid concurrency issues
        const combined = unionAll(
          db.select().from(prevIncl),
          db.select().from(next)
        ).as("combined");

        const rows = await db.select().from(combined).orderBy(asc(combined.id));

        if (!rows.length) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return { items: rows };
      }
      if (Math.random() < rate) throw new Error("idk");
      const rows = await db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.channel_id, input.channelId),
            isNull(schema.messages.deleted_at)
          )
        )
        .orderBy(desc(schema.messages.id))
        .limit(input.limit);

      return { items: rows.reverse(), returnedDirection: "backward" };
    }),
  createSpam: privateProcedureDefaultRateLimit([P.messages.create])
    .input(
      z.object({
        isBulk: z.boolean(),
        count: z.number().min(1).max(200).default(200),
        channelId: numericIdSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input?.isBulk) {
        let rows: (typeof schema.messages.$inferInsert)[] = [];
        for (let i = 0; i < input.count; i++) {
          rows.push({
            content: `${i + 1} - ${generateRandomText(minLength, maxLength, alphanumeric)}`,
            user_id: ctx.user.id,
            channel_id: input.channelId,
          });
        }
        await db.insert(schema.messages).values(rows);
      } else {
        const seed = generateRandomText(minLength, maxLength, alphanumeric);
        for (let i = 0; i < input.count; i++) {
          const randomText = `${i + 1} - ${seed}`;

          await db.insert(schema.messages).values({
            content: randomText,
            user_id: ctx.user.id,
            channel_id: input.channelId,
          });
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

      const [newRow] = await db
        .insert(schema.messages)
        .values({
          content: input.content,
          user_id: ctx.user.id,
          channel_id: input.channelId,
        })
        .returning();
      waitUntil(
        publishChannelEvent({
          data: {
            ...newRow,
            channel_id: String(newRow.channel_id),
            id: String(newRow.id),
          },
          eventName: "messages:create",
          channelId: String(input.channelId),
        }).catch((e) => console.error("Ably message create publish failed", e))
      );
      return newRow;
    }),
  update: privateProcedureDefaultRateLimit([P.messages.update])
    .input(sharedMessagesValidations.messageUpdateSchemaForm)
    .mutation(async ({ input, ctx }) => {
      throwIfZodError(
        sharedMessagesValidations
          .makeMessageUpdateSchemaForm(ctx.user.emailVerified)
          .safeParse(input)
      );

      const [updatedRow] = await db
        .update(schema.messages)
        .set({ content: input.content })
        .where(
          and(
            eq(schema.messages.id, input.id),
            eq(schema.messages.user_id, ctx.user.id)
          )
        )
        .returning();

      if (!updatedRow) throw new TRPCError({ code: "NOT_FOUND" });

      waitUntil(
        publishChannelEvent({
          data: {
            ...updatedRow,
            channel_id: String(updatedRow.channel_id),
            id: String(updatedRow.id),
          },
          eventName: "messages:update",
          channelId: String(input.channelId),
        }).catch((e) => console.error("Ably message update publish failed", e))
      );
      return updatedRow;
    }),
  delete: privateProcedureDefaultRateLimit([P.messages.delete])
    .input(sharedMessagesValidations.messageDeleteSchemaForm)
    .mutation(async ({ input, ctx }) => {
      const [deletedRow] = await db
        .update(schema.messages)
        .set({ deleted_at: sql`now()` })
        .where(
          and(
            eq(schema.messages.id, input.id),
            eq(schema.messages.user_id, ctx.user.id)
          )
        )
        .returning();

      if (!deletedRow) throw new TRPCError({ code: "NOT_FOUND" });

      waitUntil(
        publishChannelEvent({
          data: {
            id: String(deletedRow.id),
          },
          eventName: "messages:delete",
          channelId: String(deletedRow.channel_id),
        }).catch((e) => console.error("Ably message delete publish failed", e))
      );
      return true;
    }),
  deleteAll: privateProcedureDefaultRateLimit([P.messages.delete]).mutation(
    async () => {
      await db.delete(schema.messages);
    }
  ),
});
