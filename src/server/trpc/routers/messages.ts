import z from "@/utils/zod";
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
import * as serverMessagesValidations from "../validators/messages";
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
import { PartialFor, type NullableFields } from "@/utils/types";
import { AuthSession } from "../context";

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

const { deleted_at: _deleted_at, ...messageColumns } = getTableColumns(
  schema.messages
);

const pickFromShape = <
  TShape extends Record<string, unknown>,
  TSource extends { [K in keyof TShape]: unknown },
>(
  source: TSource,
  shape: TShape
) => {
  let result = {} as { [K in keyof TShape]: TSource[K] };

  for (const key of Object.keys(shape) as Array<keyof TShape>) {
    result[key] = source[key];
  }

  return result;
};

const messageAuthorColumns = {
  id: schema.user.id,
  username: schema.user.username,
  displayUsername: schema.user.displayUsername,
  name: schema.user.name,
  image: schema.user.image,
  role: schema.user.role,
};

type FullMessage = typeof schema.messages.$inferSelect;
type FullUser = typeof schema.user.$inferSelect;

type Message = Pick<FullMessage, keyof typeof messageColumns>;

type MessageAuthor = Pick<FullUser, keyof typeof messageAuthorColumns>;
type MessageWithAuthor = Message & {
  author: PartialFor<MessageAuthor, "username" | "displayUsername" | "image">;
};

const pickMessageAuthor = (
  user: NonNullable<AuthSession>["user"]
): MessageWithAuthor["author"] => ({
  id: user.id,
  username: user.username,
  displayUsername: user.displayUsername,
  name: user.name,
  image: user.image,
  role: user.role,
});

const messagesJoinOn = (...extra: Array<SQL | undefined>) =>
  and(
    eq(schema.messages.channel_id, schema.channels.id),
    isNull(schema.messages.deleted_at),
    ...extra
  );

const toMessagesPayload = (
  rows: Array<{
    messages_version: bigint;
    message: NullableFields<Message> | null;
    author: NullableFields<MessageAuthor> | null;
  }>
) => {
  if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
  const messages_version = rows[0].messages_version;
  let items: MessageWithAuthor[] = [];
  for (const row of rows) {
    if (row.message?.id && row.author?.id) {
      let newItem = row.message as MessageWithAuthor;
      newItem.author = row.author as MessageAuthor;
      items.push(newItem);
    }
  }
  return { messages_version, items };
};

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
        items: z.array(z.custom<MessageWithAuthor>()),
        returnedDirection:
          sharedMessagesValidations.infiniteListDirectionSchema,
        messages_version: versionSchema,
        isLatest: z.boolean().optional(),
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

      type Direction = NonNullable<typeof cursor>["direction"];

      const selectMessagesSubquery = ({
        extraCondition,
        direction,
      }: {
        extraCondition?: SQL;
        direction: Direction;
      }) =>
        db
          .select(messageColumns)
          .from(schema.messages)
          .where(messagesJoinOn(extraCondition))
          .orderBy(
            direction === "forward"
              ? asc(schema.messages.id)
              : desc(schema.messages.id)
          )
          .limit(input.limit)
          .as("messages_subquery");

      const selectMessageRows = ({
        extraCondition,
        direction,
      }: {
        extraCondition?: SQL;
        direction: Direction;
      }) => {
        const messagesSubquery = selectMessagesSubquery({
          extraCondition,
          direction,
        });

        return db
          .select({
            messages_version: schema.channels.messages_version,
            message: pickFromShape(messagesSubquery, messageColumns),
            author: messageAuthorColumns,
          })
          .from(schema.channels)
          .leftJoinLateral(messagesSubquery, sql`true`)
          .leftJoin(schema.user, eq(schema.user.id, messagesSubquery.user_id))
          .where(channelFilter)
          .orderBy(
            direction === "forward"
              ? asc(messagesSubquery.id)
              : desc(messagesSubquery.id)
          );
      };

      if (cursor) {
        if (cursor.direction && typeof cursor.id === "bigint") {
          if (cursor.direction === "backward") {
            if (Math.random() < rate) throw new Error("Test error");

            const rows = await selectMessageRows({
              extraCondition: before(schema.messages.id, cursor.id),
              direction: "backward",
            });

            const { messages_version, items } = toMessagesPayload(rows);
            return {
              items: items,
              messages_version,
              returnedDirection: "backward",
            };
          }

          if (cursor.direction === "forward") {
            if (Math.random() < rate) throw new Error("Test error");

            const rows = await selectMessageRows({
              extraCondition: after(schema.messages.id, cursor.id),
              direction: "forward",
            });

            const { messages_version, items } = toMessagesPayload(rows);
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
        const sideLimit = input.limit / 2;

        const selectAroundSideIds = ({
          extraCondition,
          direction,
          limit,
        }: {
          extraCondition: SQL;
          direction: Direction;
          limit: number;
        }) =>
          db
            .select({
              id: schema.messages.id,
            })
            .from(schema.channels)
            .innerJoin(schema.messages, messagesJoinOn(extraCondition))
            .where(channelFilter)
            .orderBy(
              direction === "forward"
                ? asc(schema.messages.id)
                : desc(schema.messages.id)
            )
            .limit(limit);

        const aroundIds = unionAll(
          selectAroundSideIds({
            extraCondition: beforeOrEqual(schema.messages.id, input.around),
            direction: "backward",
            limit: sideLimit + 1, // includes target
          }),
          selectAroundSideIds({
            extraCondition: after(schema.messages.id, input.around),
            direction: "forward",
            limit: sideLimit,
          })
        ).as("around_ids");

        const rows = await db
          .select({
            messages_version: schema.channels.messages_version,
            message: messageColumns,
            author: messageAuthorColumns,
          })
          .from(aroundIds)
          .innerJoin(schema.messages, eq(schema.messages.id, aroundIds.id))
          .innerJoin(
            schema.channels,
            eq(schema.channels.id, schema.messages.channel_id)
          )
          .innerJoin(schema.user, eq(schema.user.id, schema.messages.user_id))
          .where(channelFilter)
          .orderBy(asc(schema.messages.id));

        const { items, messages_version } = toMessagesPayload(rows);

        return { items, messages_version };
      }
      if (Math.random() < rate) throw new Error("Test error");

      const rows = await selectMessageRows({ direction: "backward" });
      const { messages_version, items } = toMessagesPayload(rows);

      return {
        items: items,
        messages_version,
        returnedDirection: "backward",
        isLatest: true,
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
    .mutation(async ({ input: dangerousInput, ctx }) => {
      const fullCheckResult = serverMessagesValidations
        .makeMessageCreateSchema(ctx.user.emailVerified)
        .safeParse(dangerousInput);
      throwIfZodError(fullCheckResult);
      const input = fullCheckResult.data;
      // await new Promise((r) => setTimeout(r, 1500));
      // if (Math.random() < 0.7) throw new Error("Test error");

      const author = pickMessageAuthor(ctx.user);

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
          .returning(messageColumns)
      );

      const [newData] = await db
        .with(channelUpdate, messageInsert)
        .select()
        .from(messageInsert)
        .innerJoin(channelUpdate, sql`true`);

      if (!newData?.message) throw new TRPCError({ code: "NOT_FOUND" });
      const newMessage = newData.message as MessageWithAuthor;
      newMessage.author = author;

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
      return { message: newMessage, channel: newData.channel };
    }),
  update: privateProcedure(
    [P.messages.update],
    rateLimitMiddlewares.auth_messagesWrite
  )
    .input(sharedMessagesValidations.messageUpdateSchemaForm)
    .mutation(async ({ input: dangerousInput, ctx }) => {
      const fullCheckResult = serverMessagesValidations
        .makeMessageUpdateSchema(ctx.user.emailVerified)
        .safeParse(dangerousInput);
      throwIfZodError(fullCheckResult);
      const input = fullCheckResult.data;

      const author = pickMessageAuthor(ctx.user);

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
          .returning(messageColumns)
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
      if (!updatedData.message) throw new TRPCError({ code: "NOT_FOUND" });

      const updatedMessage = updatedData.message as MessageWithAuthor;
      updatedMessage.author = author;

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
      return {
        message: updatedMessage,
        channel: updatedData.channel,
      };
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
