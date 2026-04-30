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
  isNotNull,
  gt,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { alias, unionAll } from "drizzle-orm/pg-core";
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
import type { WebsocketEventsOriginal } from "@/trpc/helpers/websockets";

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

const messagesGetOutputSchema = z.object({
  items: z.array(z.custom<JoinedMessage>()),
  returnedDirection: sharedMessagesValidations.infiniteListDirectionSchema,
  messages_version: versionSchema,
  isLatest: z.boolean().optional(),
});

// doing this for cases when some type depends on it before it gets fed to the router
// to avoid type circular dependency
export type MessagesGetOutput = z.infer<typeof messagesGetOutputSchema>;

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

const { deleted_at: _deleted_at, ...messageColumns } = getTableColumns(
  schema.messages
);

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
type JoinedMessage = Message & {
  author: PartialFor<MessageAuthor, "username" | "displayUsername" | "image">;
  parentMessage: {
    author: Pick<MessageAuthor, "name">;
    contentPreview: Message["content"];
    created_at: Message["created_at"];
    edited_at: Message["edited_at"];
  } | null;
};

const pickMessageAuthor = (
  user: NonNullable<AuthSession>["user"]
): JoinedMessage["author"] => ({
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
    parent_message: NullableFields<
      Pick<Message, "content" | "created_at" | "edited_at"> & {
        author_name: MessageAuthor["name"];
      }
    >;
  }>
) => {
  if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
  const messages_version = rows[0].messages_version;
  let items: JoinedMessage[] = [];
  for (const row of rows) {
    if (row.message?.id && row.author?.id) {
      let newItem = row.message as JoinedMessage;
      newItem.author = row.author as MessageAuthor;

      newItem.parentMessage =
        row.message.reply_to_message_id &&
        row.parent_message.content &&
        row.parent_message.created_at &&
        row.parent_message.edited_at &&
        row.parent_message.author_name
          ? {
              author: {
                name: row.parent_message.author_name,
              },
              contentPreview: row.parent_message.content.slice(
                0,
                sharedMessagesValidations.messageContentPreviewMaxLength
              ),
              created_at: row.parent_message.created_at,
              edited_at: row.parent_message.edited_at,
            }
          : null;

      items.push(newItem);
    }
  }
  return { messages_version, items };
};

export const messagesRouter = router({
  ablyTokenRequest: publicProcedure(
    rateLimitMiddlewares.websockets_token
  ).mutation(async ({ ctx }) => {
    const user = await ctx.getCachedAuth();
    const clientId =
      user && user?.response?.user?.id
        ? user.response?.user.id
        : `tmp-${randomUUID()}`;
    return createChannelSubscribeTokenRequest({
      clientId,
    });
  }),
  get: publicProcedure()
    .input(sharedMessagesValidations.messagesGetSchemaForm)
    .output(messagesGetOutputSchema)
    .query(async ({ ctx, input }) => {
      const rate = 0;
      const cursor = input.cursor;
      //await new Promise((r) => setTimeout(r, 500));

      const channelFilter = and(
        eq(schema.channels.id, input.channelId),
        isNull(schema.channels.deleted_at)
      );

      const parentMessage = alias(schema.messages, "parent_message");
      const parentAuthor = alias(schema.user, "parent_author");

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
            parent_message: {
              content: parentMessage.content,
              created_at: parentMessage.created_at,
              edited_at: parentMessage.edited_at,
              author_name: parentAuthor.name,
            },
          })
          .from(schema.channels)
          .leftJoinLateral(messagesSubquery, sql`true`)
          .leftJoin(schema.user, eq(schema.user.id, messagesSubquery.user_id))
          .leftJoin(
            parentMessage,
            and(
              eq(parentMessage.id, messagesSubquery.reply_to_message_id),
              isNull(parentMessage.deleted_at)
            )
          )
          .leftJoin(parentAuthor, eq(parentAuthor.id, parentMessage.user_id))
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
            parent_message: {
              content: parentMessage.content,
              created_at: parentMessage.created_at,
              edited_at: parentMessage.edited_at,
              author_name: parentAuthor.name,
            },
          })
          .from(aroundIds)
          .innerJoin(schema.messages, eq(schema.messages.id, aroundIds.id))
          .innerJoin(
            schema.channels,
            eq(schema.channels.id, schema.messages.channel_id)
          )
          .innerJoin(schema.user, eq(schema.user.id, schema.messages.user_id))
          .leftJoin(
            parentMessage,
            and(
              eq(parentMessage.id, schema.messages.reply_to_message_id),
              isNull(parentMessage.deleted_at)
            )
          )
          .leftJoin(parentAuthor, eq(parentAuthor.id, parentMessage.user_id))
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
  createSpam: privateProcedure([P.messages.createSpam])
    .input(
      z.object({
        isBulk: z.boolean(),
        count: z.number().min(1).max(500000).default(500000),
        channelId: numericIdSchema,
        reply_to_message_id: numericIdSchema.optional(),
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
          const randomText = `<p>${i + 1} - ${seed}</p>`;

          await db.insert(schema.messages).values({
            content: randomText,
            user_id: ctx.user.id,
            channel_id: input.channelId,
            reply_to_message_id: input.reply_to_message_id,
          });
        }
        if (input.reply_to_message_id) {
          await db
            .update(schema.messages)
            .set({
              reply_count: sql`${schema.messages.reply_count} + ${input.count}`,
            })
            .where(eq(schema.messages.id, input.reply_to_message_id));
        }
      }
    }),
  create: privateProcedure(
    [P.messages.create],
    rateLimitMiddlewares.auth_messagesWrite
  )
    .input(sharedMessagesValidations.messageCreateSchemaForm)
    .output(z.custom<WebsocketEventsOriginal["messages:create"]>())
    .mutation(async ({ input: dangerousInput, ctx }) => {
      const fullCheckResult = serverMessagesValidations
        .makeMessageCreateSchema(ctx.user.emailVerified)
        .safeParse(dangerousInput);
      throwIfZodError(fullCheckResult);
      const input = fullCheckResult.data;
      // await new Promise((r) => setTimeout(r, 1500));
      // if (Math.random() < 0.7) throw new Error("Test error");

      const author = pickMessageAuthor(ctx.user);
      const isReply = Boolean(input.reply_to_message_id);

      const replyParentMessage = alias(schema.messages, "reply_parent_message");
      const replyParentAuthor = alias(schema.user, "reply_parent_author");

      const validatedParentMessage = db.$with("reply_target").as(
        db
          .select({
            id: replyParentMessage.id,
            author_name: replyParentAuthor.name,
            content: replyParentMessage.content,
            created_at: replyParentMessage.created_at,
            edited_at: replyParentMessage.edited_at,
          })
          .from(replyParentMessage)
          .innerJoin(
            replyParentAuthor,
            eq(replyParentAuthor.id, replyParentMessage.user_id)
          )
          .where(
            isReply
              ? and(
                  eq(replyParentMessage.id, input.reply_to_message_id!),
                  eq(replyParentMessage.channel_id, input.channelId),
                  isNull(replyParentMessage.deleted_at)
                )
              : sql`false`
          )
      );

      const validatedChannel = db.$with("channel_target").as(
        db
          .select({
            id: schema.channels.id,
          })
          .from(schema.channels)
          .leftJoin(validatedParentMessage, sql`true`)
          .where(
            and(
              eq(schema.channels.id, input.channelId),
              isNull(schema.channels.deleted_at),
              isReply ? isNotNull(validatedParentMessage.id) : undefined
            )
          )
      );

      const messageInsert = db.$with("message").as(
        db
          .insert(schema.messages)
          .values({
            content: input.content,
            user_id: ctx.user.id,
            channel_id: sql`(select ${validatedChannel.id} from ${validatedChannel})`, // the whole validation relies on this check
            reply_to_message_id: isReply
              ? sql`(select ${validatedParentMessage.id} from ${validatedParentMessage})`
              : null,
          })
          .returning(messageColumns)
      );

      const channelUpdate = db.$with("channel").as(
        db
          .update(schema.channels)
          .set({
            messages_version: sql`${schema.channels.messages_version} + 1`,
          })
          .from(messageInsert)
          .where(
            and(
              eq(schema.channels.id, messageInsert.channel_id),
              isNull(schema.channels.deleted_at)
            )
          )
          .returning({
            messages_version: schema.channels.messages_version,
          })
      );

      const parentMessageUpdate = db.$with("parent_message").as(
        db
          .update(schema.messages)
          .set({
            reply_count: sql`${schema.messages.reply_count} + 1`,
          })
          .from(messageInsert)
          .where(eq(schema.messages.id, messageInsert.reply_to_message_id))
          .returning({
            reply_count: schema.messages.reply_count,
          })
      );

      const [newData] = await db
        .with(
          validatedParentMessage,
          validatedChannel,
          messageInsert,
          parentMessageUpdate,
          channelUpdate
        )
        .select({
          message: pickFromShape(messageInsert, messageColumns),
          channel_messages_version: channelUpdate.messages_version,
          parent_message: {
            id: validatedParentMessage.id,
            author_name: validatedParentMessage.author_name,
            content: validatedParentMessage.content,
            created_at: validatedParentMessage.created_at,
            edited_at: validatedParentMessage.edited_at,
            reply_count: parentMessageUpdate.reply_count,
          },
        })
        .from(messageInsert)
        .innerJoin(channelUpdate, sql`true`)
        .leftJoin(parentMessageUpdate, sql`true`)
        .leftJoin(
          validatedParentMessage,
          eq(validatedParentMessage.id, messageInsert.reply_to_message_id)
        );

      if (!newData?.message || !newData.channel_messages_version) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const newMessage = newData.message as JoinedMessage;
      newMessage.author = author;
      newMessage.parentMessage =
        newData.parent_message.author_name &&
        newData.parent_message.content &&
        newData.parent_message.created_at &&
        newData.parent_message.edited_at
          ? {
              author: {
                name: newData.parent_message.author_name,
              },
              contentPreview: newData.parent_message.content.slice(
                0,
                sharedMessagesValidations.messageContentPreviewMaxLength
              ),
              created_at: newData.parent_message.created_at,
              edited_at: newData.parent_message.edited_at,
            }
          : null;

      const parentMessageIdSerialized = newMessage.reply_to_message_id
        ? String(newMessage.reply_to_message_id)
        : null;

      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              ...newMessage,
              channel_id: String(newMessage.channel_id),
              id: String(newMessage.id),
              reply_to_message_id: parentMessageIdSerialized,
            },
            messagesVersion: String(newData.channel_messages_version),
            parentMessageUpdate:
              parentMessageIdSerialized &&
              typeof newData.parent_message.reply_count === "number"
                ? {
                    reply_count: newData.parent_message.reply_count,
                    id: parentMessageIdSerialized,
                  }
                : null,
          },
          eventName: "messages:create",
          channelId: String(newMessage.channel_id),
        }).catch((e) => console.error("Ably message create publish failed", e))
      );
      return {
        message: newMessage,
        messagesVersion: newData.channel_messages_version,
        parentMessageUpdate:
          newData.parent_message.id &&
          typeof newData.parent_message.reply_count === "number"
            ? {
                reply_count: newData.parent_message.reply_count,
                id: newData.parent_message.id,
              }
            : null,
      };
    }),
  update: privateProcedure(
    [P.messages.update],
    rateLimitMiddlewares.auth_messagesWrite
  )
    .input(sharedMessagesValidations.messageUpdateSchemaForm)
    .output(z.custom<WebsocketEventsOriginal["messages:update"]>())
    .mutation(async ({ input: dangerousInput, ctx }) => {
      const fullCheckResult = serverMessagesValidations
        .makeMessageUpdateSchema(ctx.user.emailVerified)
        .safeParse(dangerousInput);
      throwIfZodError(fullCheckResult);
      const input = fullCheckResult.data;

      const messageUpdate = db.$with("message").as(
        db
          .update(schema.messages)
          .set({ content: input.content, edited_at: sql`now()` })
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

      const updatedMessage = updatedData.message;

      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              content: updatedMessage.content,
              id: String(updatedMessage.id),
              reply_count: updatedMessage.reply_count,
              edited_at: updatedMessage.edited_at,
            },
            messagesVersion: String(updatedData.channel.messages_version),
          },
          eventName: "messages:update",
          channelId: String(updatedMessage.channel_id),
        }).catch((e) => console.error("Ably message update publish failed", e))
      );
      return {
        message: {
          content: updatedMessage.content,
          id: updatedMessage.id,
          reply_count: updatedMessage.reply_count,
          edited_at: updatedMessage.edited_at,
        },
        messagesVersion: updatedData.channel.messages_version,
      };
    }),
  delete: privateProcedure(
    [P.messages.delete],
    rateLimitMiddlewares.auth_messagesWrite
  )
    .input(sharedMessagesValidations.messageDeleteSchemaForm)
    .output(z.custom<WebsocketEventsOriginal["messages:delete"]>())
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
          .returning(pickFromShape(schema.messages, messageColumns))
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

      const parentMessageUpdate = db.$with("parent_message").as(
        db
          .update(schema.messages)
          .set({
            reply_count: sql`greatest(${schema.messages.reply_count} - 1, 0)`,
          })
          .from(messageUpdate)
          .where(eq(schema.messages.id, messageUpdate.reply_to_message_id))
          .returning({
            id: schema.messages.id,
            reply_count: schema.messages.reply_count,
          })
      );

      const [updatedData] = await db
        .with(messageUpdate, channelUpdate, parentMessageUpdate)
        .select()
        .from(messageUpdate)
        .innerJoin(channelUpdate, sql`true`)
        .leftJoin(parentMessageUpdate, sql`true`);

      const updatedMessage = updatedData?.message;
      if (!updatedMessage) throw new TRPCError({ code: "NOT_FOUND" });

      const parentMessage = updatedData.parent_message;
      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              id: String(updatedMessage.id),
            },
            messagesVersion: String(updatedData.channel.messages_version),
            parentMessageUpdate:
              parentMessage?.id && typeof parentMessage.reply_count === "number"
                ? {
                    reply_count: parentMessage.reply_count,
                    id: String(parentMessage.id),
                  }
                : null,
          },
          eventName: "messages:delete",
          channelId: String(updatedMessage.channel_id),
        }).catch((e) => console.error("Ably message delete publish failed", e))
      );
      return {
        message: { id: updatedMessage.id },
        messagesVersion: updatedData.channel.messages_version,
        parentMessageUpdate:
          updatedData.parent_message?.id &&
          typeof updatedData.parent_message?.reply_count === "number"
            ? {
                reply_count: updatedData.parent_message.reply_count,
                id: updatedData.parent_message.id,
              }
            : null,
      };
    }),
  deleteAll: privateProcedure([P.messages.delete])
    .input(sharedMessagesValidations.messageBulkDeleteSchemaForm)
    .mutation(async ({ input }) => {
      await db
        .update(schema.messages)
        .set({ deleted_at: sql`now()` })
        .where(eq(schema.messages.channel_id, input.channelId));
    }),
  getReplies: publicProcedure()
    .input(sharedMessagesValidations.messagesGetRepliesSchemaForm)
    .output(
      z.object({
        items: z.custom<JoinedMessage[]>(),
        totalItems: z.number(),
        page: z.number(),
      })
    )
    .query(async ({ input }) => {
      const page = input.page;
      const pageSize = input.pageSize;
      const offset = (page - 1) * pageSize;

      const parentMessage = alias(schema.messages, "parent_message");
      const replyScan = alias(schema.messages, "reply_scan");

      const replyIds = db
        .select({
          id: replyScan.id,
        })
        .from(replyScan)
        .where(
          and(
            eq(replyScan.reply_to_message_id, parentMessage.id),
            isNull(replyScan.deleted_at),
            gt(parentMessage.reply_count, offset)
          )
        )
        .orderBy(asc(replyScan.id))
        .limit(pageSize)
        .offset(offset)
        .as("reply_page");

      const rows = await db
        .select({
          totalItems: parentMessage.reply_count,
          message: pickFromShape(schema.messages, messageColumns),
          author: messageAuthorColumns,
        })
        .from(parentMessage)
        .leftJoinLateral(replyIds, sql`true`)
        .leftJoin(schema.messages, eq(schema.messages.id, replyIds.id))
        .leftJoin(schema.user, eq(schema.user.id, schema.messages.user_id))
        .innerJoin(
          schema.channels,
          eq(schema.channels.id, parentMessage.channel_id)
        )
        .where(
          and(
            eq(parentMessage.id, input.messageId),
            isNull(parentMessage.deleted_at),
            isNull(schema.channels.deleted_at)
          )
        )
        .orderBy(asc(schema.messages.id));

      if (!rows.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Parent message not found.",
        });
      }

      const totalItems = rows[0].totalItems;

      const items: JoinedMessage[] = [];

      for (const row of rows) {
        if (!row.message?.id || !row.author?.id) continue;

        let newItem = row.message as JoinedMessage;
        newItem.author = row.author as JoinedMessage["author"];
        newItem.parentMessage = null;

        items.push(newItem);
      }

      return {
        items,
        totalItems,
        page,
      };
    }),
});
