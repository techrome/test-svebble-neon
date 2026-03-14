import z from "zod";
import {
  eq,
  desc,
  asc,
  and,
  isNull,
  sql,
  getTableColumns,
  type SQL,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { unionAll } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";
import { waitUntil } from "@vercel/functions";

import { db } from "../../db/core";
import * as schema from "../../db/schema";
import { router } from "../core";
import { privateProcedure, publicProcedure } from "../procedures";
import * as sharedMessagesValidations from "@/utils/validators/shared/messages";
import { throwIfZodError } from "../helpers/validate";
import { P } from "@/utils/permissions";
import { after, before, beforeOrEqual } from "../../db/helpers/time";
import {
  createChannelSubscribeTokenRequest,
  publishChannelEvent,
} from "../../websockets/core";
import { rateLimitMiddlewares } from "../ratelimit";
import {
  numericIdSchema,
  versionSchema,
} from "@/utils/validators/helpers/custom";
import { type NullableFields } from "@/utils/types";

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
    .mutation(async ({ ctx }) => {
      const user = await ctx.getCachedAuth();
      const clientId =
        user && user?.response?.user?.id
          ? user.response?.user.id
          : `tmp-${randomUUID()}`;
      return createChannelSubscribeTokenRequest({
        clientId,
      });
    }),
  get: publicProcedure
    .input(sharedMessagesValidations.messagesGetSchemaForm)
    .output(
      z.object({
        items: z.array(z.custom<Message>()),
        returnedDirection:
          sharedMessagesValidations.messagesGetSchemaForm.shape.direction.optional(),
        messages_version: versionSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const rate = 0;
      const cursor = input.cursor;
      //await new Promise((r) => setTimeout(r, 500));

      const channelFilter = and(
        eq(schema.channels.id, input.channelId),
        isNull(schema.channels.deleted_at)
      );

      const messagesJoinOn = (...extra: Array<SQL | undefined>) =>
        and(
          eq(schema.messages.channel_id, schema.channels.id),
          isNull(schema.messages.deleted_at),
          ...extra
        );

      const toPayload = (
        rows: Array<{
          messages_version: bigint;
          message: NullableFields<Message> | null;
        }>
      ) => {
        if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
        const messages_version = rows[0].messages_version;
        const items = rows.flatMap((r) =>
          r.message && r.message.id ? [r.message as Message] : []
        );
        return { messages_version, items };
      };

      if (cursor) {
        if (cursor.direction && cursor.id) {
          if (cursor.direction === "backward") {
            if (Math.random() < rate) throw new Error("Test error");

            const rows = await db
              .select({
                messages_version: schema.channels.messages_version,
                message: schema.messages,
              })
              .from(schema.channels)
              .leftJoin(
                schema.messages,
                and(messagesJoinOn(before(schema.messages.id, cursor.id)))
              )
              .where(channelFilter)
              .orderBy(desc(schema.messages.id))
              .limit(input.limit);

            const { messages_version, items } = toPayload(rows);
            return {
              items: items.reverse(),
              messages_version,
              returnedDirection: "backward",
            };
          }

          if (cursor.direction === "forward") {
            if (Math.random() < rate) throw new Error("Test error");

            const rows = await db
              .select({
                messages_version: schema.channels.messages_version,
                message: schema.messages,
              })
              .from(schema.channels)
              .leftJoin(
                schema.messages,
                and(messagesJoinOn(after(schema.messages.id, cursor.id)))
              )
              .where(channelFilter)
              .orderBy(asc(schema.messages.id))
              .limit(input.limit);

            const { messages_version, items } = toPayload(rows);
            return {
              items,
              messages_version,
              returnedDirection: "forward",
            };
          }
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cursor requires id and direction",
        });
      }
      if (input.around) {
        if (Math.random() < rate) throw new Error("Test error");
        const sideLimit = input.limit / 2;

        const prevIncl = db
          .select({
            messages_version: schema.channels.messages_version,
            message: getTableColumns(schema.messages),
          })
          .from(schema.channels)
          .leftJoin(
            schema.messages,
            and(messagesJoinOn(beforeOrEqual(schema.messages.id, input.around)))
          )
          .where(channelFilter)
          .orderBy(desc(schema.messages.id))
          .limit(sideLimit + 1) // +1 because it includes the target message
          .as("prevIncl");

        const next = db
          .select({
            messages_version: schema.channels.messages_version,
            message: getTableColumns(schema.messages),
          })
          .from(schema.channels)
          .leftJoin(
            schema.messages,
            and(messagesJoinOn(after(schema.messages.id, input.around)))
          )
          .where(channelFilter)
          .orderBy(asc(schema.messages.id))
          .limit(sideLimit)
          .as("next");

        // using union to make it a single db call and avoid concurrency issues
        const combined = unionAll(
          db.select().from(prevIncl),
          db.select().from(next)
        ).as("combined");

        const rows = await db
          .select()
          .from(combined)
          .orderBy(asc(combined.message.id));

        const { items, messages_version } = toPayload(rows);

        return { items, messages_version };
      }
      if (Math.random() < rate) throw new Error("Test error");

      const rows = await db
        .select({
          messages_version: schema.channels.messages_version,
          message: schema.messages,
        })
        .from(schema.channels)
        .leftJoin(schema.messages, and(messagesJoinOn()))
        .where(channelFilter)
        .orderBy(desc(schema.messages.id))
        .limit(input.limit);

      const { messages_version, items } = toPayload(rows);

      return {
        items: items.reverse(),
        messages_version,
        returnedDirection: "backward",
      };
    }),
  createSpam: privateProcedure([P.messages.create])
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
  create: privateProcedure(
    [P.messages.create],
    rateLimitMiddlewares.auth_messagesWrite
  )
    .input(sharedMessagesValidations.messageCreateSchemaForm)
    .mutation(async ({ input, ctx }) => {
      throwIfZodError(
        sharedMessagesValidations
          .makeMessageCreateSchemaForm(ctx.user.emailVerified)
          .safeParse(input)
      );

      const channelUpdate = db.$with("channel").as(
        db
          .update(schema.channels)
          .set({
            messages_version: sql`${schema.channels.messages_version} + 1`,
          })
          .where(
            and(
              eq(schema.channels.id, input.channelId),
              isNull(schema.channels.deleted_at)
            )
          )
          .returning({
            messages_version: schema.channels.messages_version,
            id: schema.channels.id,
          })
      );

      const messageInsert = db.$with("message").as(
        db
          .insert(schema.messages)
          .values({
            content: input.content,
            user_id: ctx.user.id,
            channel_id: sql`(select ${channelUpdate.id} from ${channelUpdate})`,
          })
          .returning()
      );

      const [newData] = await db
        .with(channelUpdate, messageInsert)
        .select()
        .from(messageInsert)
        .innerJoin(channelUpdate, sql`true`);

      const newMessage = newData?.message;
      if (!newMessage) throw new TRPCError({ code: "NOT_FOUND" });

      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              ...newMessage,
              channel_id: String(newMessage.channel_id),
              id: String(newMessage.id),
            },
            messagesVersion: String(newData.channel.messages_version),
          },
          eventName: "messages:create",
          channelId: String(newMessage.channel_id),
        }).catch((e) => console.error("Ably message create publish failed", e))
      );
      return newData;
    }),
  update: privateProcedure(
    [P.messages.update],
    rateLimitMiddlewares.auth_messagesWrite
  )
    .input(sharedMessagesValidations.messageUpdateSchemaForm)
    .mutation(async ({ input, ctx }) => {
      throwIfZodError(
        sharedMessagesValidations
          .makeMessageUpdateSchemaForm(ctx.user.emailVerified)
          .safeParse(input)
      );

      const messageUpdate = db.$with("message").as(
        db
          .update(schema.messages)
          .set({ content: input.content })
          .from(schema.channels)
          .where(
            and(
              eq(schema.messages.id, input.id),
              eq(schema.messages.user_id, ctx.user.id),
              isNull(schema.messages.deleted_at),
              isNull(schema.channels.deleted_at),
              eq(schema.messages.channel_id, schema.channels.id)
            )
          )
          .returning(getTableColumns(schema.messages))
      );

      const channelUpdate = db.$with("channel").as(
        db
          .update(schema.channels)
          .set({
            messages_version: sql`${schema.channels.messages_version} + 1`,
          })
          .where(
            and(
              eq(
                schema.channels.id,
                sql`(select ${messageUpdate.channel_id} from ${messageUpdate})`
              ),
              isNull(schema.channels.deleted_at)
            )
          )
          .returning({
            messages_version: schema.channels.messages_version,
          })
      );

      const [updatedData] = await db
        .with(messageUpdate, channelUpdate)
        .select()
        .from(messageUpdate)
        .innerJoin(channelUpdate, sql`true`);

      const updatedMessage = updatedData?.message;
      if (!updatedMessage) throw new TRPCError({ code: "NOT_FOUND" });

      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              ...updatedMessage,
              channel_id: String(updatedMessage.channel_id),
              id: String(updatedMessage.id),
            },
            messagesVersion: String(updatedData.channel.messages_version),
          },
          eventName: "messages:update",
          channelId: String(updatedMessage.channel_id),
        }).catch((e) => console.error("Ably message update publish failed", e))
      );
      return updatedData;
    }),
  delete: privateProcedure(
    [P.messages.delete],
    rateLimitMiddlewares.auth_messagesWrite
  )
    .input(sharedMessagesValidations.messageDeleteSchemaForm)
    .mutation(async ({ input, ctx }) => {
      const messageUpdate = db.$with("message").as(
        db
          .update(schema.messages)
          .set({ deleted_at: sql`now()` })
          .from(schema.channels)
          .where(
            and(
              eq(schema.messages.id, input.id),
              eq(schema.messages.user_id, ctx.user.id),
              isNull(schema.messages.deleted_at),
              isNull(schema.channels.deleted_at),
              eq(schema.messages.channel_id, schema.channels.id)
            )
          )
          .returning(getTableColumns(schema.messages))
      );

      const channelUpdate = db.$with("channel").as(
        db
          .update(schema.channels)
          .set({
            messages_version: sql`${schema.channels.messages_version} + 1`,
          })
          .where(
            and(
              eq(
                schema.channels.id,
                sql`(select ${messageUpdate.channel_id} from ${messageUpdate})`
              ),
              isNull(schema.channels.deleted_at)
            )
          )
          .returning({
            messages_version: schema.channels.messages_version,
          })
      );

      const [updatedData] = await db
        .with(messageUpdate, channelUpdate)
        .select()
        .from(messageUpdate)
        .innerJoin(channelUpdate, sql`true`);

      const updatedMessage = updatedData?.message;
      if (!updatedMessage) throw new TRPCError({ code: "NOT_FOUND" });

      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              id: String(updatedMessage.id),
            },
            messagesVersion: String(updatedData.channel.messages_version),
          },
          eventName: "messages:delete",
          channelId: String(updatedMessage.channel_id),
        }).catch((e) => console.error("Ably message delete publish failed", e))
      );
      return updatedData;
    }),
  deleteAll: privateProcedure([P.messages.delete])
    .input(sharedMessagesValidations.messageBulkDeleteSchemaForm)
    .mutation(async ({ input }) => {
      await db
        .update(schema.messages)
        .set({ deleted_at: sql`now()` })
        .where(eq(schema.messages.channel_id, input.channelId));
    }),
});
