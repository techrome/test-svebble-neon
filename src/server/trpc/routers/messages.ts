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
  inArray,
  count,
  SQLWrapper,
} from "drizzle-orm";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { alias, unionAll } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";
import { waitUntil } from "@vercel/functions";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { db } from "../../db/core";
import * as schema from "../../db/schema";
import { router } from "../core";
import { privateProcedure, publicProcedure } from "../procedures";
import * as sharedMessagesValidations from "@/utils/validators/shared/messages";
import * as serverMessagesValidations from "../validators/messages";
import {
  throwIfZodError,
  validateMessageAttachmentExtension,
  validateUserFileKey,
} from "../helpers/validate";
import { P } from "@/utils/permissions";
import { after, before, beforeOrEqual } from "../../db/helpers/time";
import { s3Client } from "../../storage/s3";
import {
  createChannelSubscribeTokenRequest,
  publishChannelEvent,
} from "../../websockets/core";
import { rateLimitMiddlewares } from "../ratelimit";
import {
  getFileExtension,
  numericIdSchema,
  versionSchema,
} from "@/utils/validators/helpers/custom";
import { PartialFor, StrictOmit, type NullableFields } from "@/utils/types";
import { AuthSession } from "../context";
import type { WebsocketEventsOriginal } from "@/trpc/helpers/websockets";
import { leftText } from "../../db/helpers/stringUtils";
import {
  allowedMessageAttachmentExtensions,
  allowedMessageAttachmentExtensionsMap,
  isImageExtension,
} from "@/utils/validators/sharedValues/messages";
import { env } from "../../env";
import { cacheControl } from "../../storage/vars";
import { minutes } from "@/utils/cacheTime";
import { FILE_PURPOSE, FILE_STATUS } from "../../db/helpers/enums";
import { env as clientEnv } from "@/utils/env";
import { probeFileType } from "../helpers/probeFileType";
import { isDev } from "@/utils/isDev";
import { moderateImage } from "../helpers/openai";
import { probeImageDimensionsAndType } from "../helpers/probeImage";
import { emptyJsonArray, jsonAggBuildArray } from "../helpers/jsonSQL";
import { firstNonNull, sqlAny, sqlArray } from "../../db/helpers/sql";

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

const pickByShape = <
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

const {
  deleted_at: _deleted_at,
  content_text: _content_text,
  ...messageColumns
} = getTableColumns(schema.messages);

const messageAuthorColumns = {
  id: schema.user.id,
  username: schema.user.username,
  displayUsername: schema.user.displayUsername,
  name: schema.user.name,
  image: schema.user.image,
  role: schema.user.role,
};

const messageFileColumns = {
  id: schema.files.id,
  object_key: schema.files.object_key,
  original_name: schema.files.original_name,
  extension: schema.files.extension,
  size_bytes: schema.files.size_bytes,
};

export type FullMessage = typeof schema.messages.$inferSelect;
export type FullFile = typeof schema.files.$inferSelect;
export type FullMessageAttachment =
  typeof schema.message_attachments.$inferSelect;
type FullUser = typeof schema.user.$inferSelect;

type Message = Pick<FullMessage, keyof typeof messageColumns>;

type MessageAuthor = PartialFor<
  Pick<FullUser, keyof typeof messageAuthorColumns>,
  "username" | "displayUsername" | "image"
>;
type JoinedMessage = Message & {
  author: MessageAuthor;
  parentMessage: {
    contentPreview: FullMessage["content_text"];
    created_at: FullMessage["created_at"];
    edited_at: FullMessage["edited_at"];
    author: MessageAuthor;
  } | null;
  attachments: Array<
    Pick<
      FullFile,
      "id" | "object_key" | "original_name" | "extension" | "size_bytes"
    > &
      Pick<FullMessageAttachment, "sort_order">
  >;
};
type ReplyMessage = StrictOmit<JoinedMessage, "content" | "attachments"> & {
  contentPreview: FullMessage["content_text"];
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

const toMessagesPayload = (
  rows: Array<{
    messages_version: number;
    message: NullableFields<Message> | null;
    author: NullableFields<MessageAuthor> | null;
    parent_message: NullableFields<
      Pick<FullMessage, "created_at" | "edited_at"> & {
        contentPreview: FullMessage["content_text"];
      }
    > | null;
    parent_message_author: MessageAuthor | null;
    attachments: JoinedMessage["attachments"] | null;
  }>
) => {
  if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
  const messages_version = rows[0].messages_version;
  let items: JoinedMessage[] = [];
  for (const row of rows) {
    if (row.message?.id && row.author?.id) {
      let newItem = row.message as JoinedMessage;
      newItem.author = row.author as MessageAuthor;
      newItem.attachments = row.attachments?.length ? row.attachments : [];

      newItem.parentMessage =
        row.message.reply_to_message_id &&
        row.parent_message?.created_at &&
        row.parent_message?.edited_at &&
        row.parent_message_author
          ? {
              author: row.parent_message_author,
              contentPreview: row.parent_message.contentPreview || "",
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
    .query(async ({ input }) => {
      const rate = 0;
      const cursor = input.cursor;
      //await new Promise((r) => setTimeout(r, 500));

      const channelFilter = and(
        eq(schema.channels.id, input.channelId),
        isNull(schema.channels.deleted_at)
      );

      const buildMessagesFilter = (extraCondition?: SQL) =>
        and(
          eq(schema.messages.channel_id, input.channelId),
          isNull(schema.messages.deleted_at),
          extraCondition
        );

      type FileColumnsSource = Record<
        keyof typeof messageFileColumns,
        SQLWrapper
      >;
      type AttachmentColumnsSource = Record<
        keyof FullMessageAttachment,
        SQLWrapper
      >;
      const buildAttachmentsAggregator = (
        fileColumnsSource: FileColumnsSource,
        attachmentColumnsSource: AttachmentColumnsSource
      ) =>
        jsonAggBuildArray<JoinedMessage["attachments"]>(
          {
            ...pickByShape(fileColumnsSource, messageFileColumns),
            sort_order: attachmentColumnsSource.sort_order,
          },
          {
            orderBy: attachmentColumnsSource.sort_order,
            noFallbackArray: true,
          }
        ).as("attachments");

      const parentMessage = alias(schema.messages, "parent_message");
      const parentAuthor = alias(schema.user, "parent_author");

      type Direction = NonNullable<typeof cursor>["direction"];

      type SelectMessagesArgs = {
        direction: Direction;
        extraCondition?: SQL;
        limit?: number;
      };

      const selectMessages = ({
        extraCondition,
        direction,
        limit = input.limit,
      }: SelectMessagesArgs) =>
        db
          .select(messageColumns)
          .from(schema.messages)
          .where(buildMessagesFilter(extraCondition))
          .orderBy(
            direction === "forward"
              ? asc(schema.messages.id)
              : desc(schema.messages.id)
          )
          .limit(limit);

      const buildDirectionalMessagesSubquery = (args: SelectMessagesArgs) =>
        db.$with("messages_subquery").as(selectMessages(args));

      type MessagesSubquery = ReturnType<
        typeof buildDirectionalMessagesSubquery
      >;

      const buildFullQuery = ({
        messagesSubquery,
        direction,
      }: {
        messagesSubquery: MessagesSubquery;
        direction: Direction;
      }) => {
        const attachmentsSubquery = db.$with("attachments_subquery").as(
          db
            .select()
            .from(schema.message_attachments)
            .where(
              eq(
                schema.message_attachments.message_id,
                // ANY(ARRAY(...)) to avoid bad plans when PostgreSQL misjudges row counts.
                // Normal data in this table won't ever hit this, but apparently outliers with lots of
                // related records can make the planner choose a seq scan
                // e.g. tested with a few outlier messages that had thousands of attachments
                sqlAny(
                  sqlArray(
                    db
                      .select({ id: messagesSubquery.id })
                      .from(messagesSubquery)
                  )
                )
              )
            )
        );

        const filesSubquery = db.$with("files_subquery").as(
          db
            .select(messageFileColumns)
            .from(schema.files)
            .where(
              and(
                eq(
                  schema.files.id,
                  sqlAny(
                    sqlArray(
                      db
                        .select({ file_id: attachmentsSubquery.file_id })
                        .from(attachmentsSubquery)
                    )
                  )
                ),
                eq(schema.files.status, FILE_STATUS.active)
              )
            )
        );

        const attachmentsByMessageSubquery = db
          .$with("attachments_by_message_subquery")
          // needs materialized because the planner may underestimate the row count and choose a slow plan
          .materialized()
          .as(
            db
              .select({
                message_id: attachmentsSubquery.message_id,
                attachments: buildAttachmentsAggregator(
                  filesSubquery,
                  attachmentsSubquery
                ),
              })
              .from(attachmentsSubquery)
              .innerJoin(
                filesSubquery,
                eq(filesSubquery.id, attachmentsSubquery.file_id)
              )
              .groupBy(attachmentsSubquery.message_id)
          );

        return db
          .with(
            messagesSubquery,
            attachmentsSubquery,
            filesSubquery,
            attachmentsByMessageSubquery
          )
          .select({
            messages_version: schema.channels.messages_version,
            message: pickByShape(messagesSubquery, messageColumns),
            attachments: firstNonNull<JoinedMessage["attachments"]>(
              attachmentsByMessageSubquery.attachments,
              emptyJsonArray()
            ).as("attachments"),

            author: messageAuthorColumns,
            parent_message: {
              contentPreview: leftText(
                parentMessage.content_text,
                sharedMessagesValidations.messageContentPreviewMaxLength
              ),
              created_at: parentMessage.created_at,
              edited_at: parentMessage.edited_at,
            },
            parent_message_author: pickByShape(
              parentAuthor,
              messageAuthorColumns
            ),
          })
          .from(schema.channels)
          .leftJoin(messagesSubquery, sql`true`)
          .leftJoin(
            attachmentsByMessageSubquery,
            eq(attachmentsByMessageSubquery.message_id, messagesSubquery.id)
          )
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
        if (cursor.direction && typeof cursor.id === "number") {
          if (cursor.direction === "backward") {
            if (Math.random() < rate) throw new Error("Test error");

            const rows = await buildFullQuery({
              messagesSubquery: buildDirectionalMessagesSubquery({
                extraCondition: before(schema.messages.id, cursor.id),
                direction: "backward",
              }),
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

            const rows = await buildFullQuery({
              messagesSubquery: buildDirectionalMessagesSubquery({
                extraCondition: after(schema.messages.id, cursor.id),
                direction: "forward",
              }),
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

        const messagesSubquery = db.$with("messages_subquery").as(
          unionAll(
            selectMessages({
              extraCondition: beforeOrEqual(schema.messages.id, input.around),
              direction: "backward",
              limit: sideLimit + 1, // includes target
            }),
            selectMessages({
              extraCondition: after(schema.messages.id, input.around),
              direction: "forward",
              limit: sideLimit,
            })
          )
        );

        const rows = await buildFullQuery({
          messagesSubquery,
          direction: "forward",
        });

        const { items, messages_version } = toMessagesPayload(rows);

        return { items, messages_version };
      }
      if (Math.random() < rate) throw new Error("Test error");

      const rows = await buildFullQuery({
        messagesSubquery: buildDirectionalMessagesSubquery({
          direction: "backward",
        }),
        direction: "backward",
      });

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
        count: z.number().min(1).max(20000).default(20000),
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
            content_text: `${i + 1} - ${generateRandomText(minLength, maxLength, alphanumeric)}`,
            user_id: ctx.user.id,
            channel_id: input.channelId,
          });
        }
        await db.insert(schema.messages).values(rows);
      } else {
        const seed = generateRandomText(minLength, maxLength, alphanumeric);
        for (let i = 0; i < input.count; i++) {
          const randomText = `${i + 1} - ${seed}`;
          const randomTextHtml = `<p>${randomText}</p>`;

          await db.insert(schema.messages).values({
            content: randomTextHtml,
            content_text: randomText,
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
  createAttachmentUploadUrl: privateProcedure(
    [P.messageAttachments.create],
    rateLimitMiddlewares.auth_messagesAttachments
  )
    .input(sharedMessagesValidations.createMessageAttachmentUploadUrlSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const imageMimeType =
        allowedMessageAttachmentExtensionsMap[input.fileExtension];

      const bucketKey = `users/${userId}/${randomUUID()}.${input.fileExtension}`;

      const uploadCommand = new PutObjectCommand({
        Bucket: env.BACKBLAZE_BUCKET_NAME!,
        Key: bucketKey,
        ContentType: imageMimeType,
        ContentLength: input.fileSize,
        CacheControl: cacheControl,
      });

      const expiresIn = minutes(10, true);

      const uploadUrl = await getSignedUrl(s3Client, uploadCommand, {
        expiresIn,
        signableHeaders: new Set(["content-type", "cache-control"]),
      });

      await db.insert(schema.files).values({
        object_key: bucketKey,
        owner_user_id: userId,
        purpose: FILE_PURPOSE.message_attachment,
        status: FILE_STATUS.issued,
        original_name: input.fileName,
        extension: input.fileExtension,
        size_bytes: input.fileSize,
      });

      return {
        bucketKey,
        uploadUrl,
        requiredHeaders: {
          "Content-Type": imageMimeType,
          "Cache-Control": cacheControl,
        } as const,
      };
    }),
  validateMessageAttachment: privateProcedure(
    [P.messageAttachments.create],
    rateLimitMiddlewares.auth_messagesAttachments
  )
    .input(sharedMessagesValidations.finalizeMessageAttachmentSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const newFileKey = input.fileObjectKey;
      const nonVerifiedExtension = getFileExtension(
        newFileKey,
        allowedMessageAttachmentExtensions
      );
      if (
        !validateUserFileKey(
          userId,
          newFileKey,
          allowedMessageAttachmentExtensions
        ) ||
        !nonVerifiedExtension
      ) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Invalid file key.",
        });
      }
      const pendingFileFilter = and(
        eq(schema.files.object_key, newFileKey),
        eq(schema.files.purpose, FILE_PURPOSE.message_attachment),
        eq(schema.files.owner_user_id, ctx.user.id),
        eq(schema.files.status, FILE_STATUS.issued)
      );

      const [foundPendingFile] = await db
        .select({ id: schema.files.id })
        .from(schema.files)
        .where(pendingFileFilter);

      if (!foundPendingFile) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Invalid file key.",
        });
      }

      let realExtension: string;
      const newFileUrl = `${clientEnv.NEXT_PUBLIC_CDN_URL}/${newFileKey}`;
      const isImage = isImageExtension(nonVerifiedExtension);

      if (isImage) {
        const probeResult = await probeImageDimensionsAndType(newFileUrl);
        if (isDev) {
          console.log({ probeResult });
        }
        throwIfZodError(
          sharedMessagesValidations.messageAttachmentImageSchema.safeParse({
            width: probeResult.width,
            height: probeResult.height,
          } satisfies z.infer<
            typeof sharedMessagesValidations.messageAttachmentImageSchema
          >)
        );
        realExtension = probeResult.detectedFileType.ext;
      } else {
        const probeResult = await probeFileType(newFileUrl);
        if (isDev) {
          console.log({ probeResult });
        }
        realExtension =
          probeResult.kind === "binary"
            ? probeResult.detectedFileType.ext
            : "txt";
      }

      if (
        !validateMessageAttachmentExtension(nonVerifiedExtension, realExtension)
      ) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: `File extension mismatch. Expected: ${nonVerifiedExtension}. Received: ${realExtension}.`,
        });
      }

      if (isImage) {
        let moderationResult: Awaited<ReturnType<typeof moderateImage>>;

        try {
          moderationResult = await moderateImage(newFileUrl);
        } catch (err) {
          console.error(
            "Error moderating image file",
            err,
            "STRINGIFIED:",
            JSON.stringify(err)
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
          });
        }
        const flagged = moderationResult.results?.[0]?.flagged || false;
        if (flagged) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: env.BACKBLAZE_BUCKET_NAME!,
                Key: newFileKey,
              })
            );
            await db
              .update(schema.files)
              .set({
                status: FILE_STATUS.deleted,
                info_text: `Moderation rejected. Details: ${JSON.stringify(moderationResult.results?.[0])}`,
              })
              .where(pendingFileFilter);
          } catch (err) {
            const errorText = `Failed to delete the avatar image from the bucket. Key was: ${newFileKey}. Error: ${JSON.stringify(err)}`;
            console.error(errorText);
            await db
              .update(schema.files)
              .set({
                status: FILE_STATUS.error,
                error_text: errorText,
              })
              .where(pendingFileFilter);
          }
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message:
              "Image rejected by moderation. Please try a different file.",
          });
        }
      }

      const [updatedRow] = await db
        .update(schema.files)
        .set({
          status: FILE_STATUS.validated,
        })
        .where(pendingFileFilter)
        .returning({ id: schema.files.id });

      return { id: updatedRow.id };
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
      const userId = ctx.user.id;
      const author = pickMessageAuthor(ctx.user);
      const isReply = Boolean(input.reply_to_message_id);
      const attachmentIds = input.attachmentIds;
      const attachmentCount = attachmentIds.length;

      const replyParentMessage = alias(schema.messages, "reply_parent_message");
      const replyParentAuthor = alias(schema.user, "reply_parent_author");

      const validatedAttachments = db.$with("validated_attachments").as(
        db
          .select({
            id: schema.files.id,
            object_key: schema.files.object_key,
            original_name: schema.files.original_name,
            size_bytes: schema.files.size_bytes,
            extension: schema.files.extension,
          })
          .from(schema.files)
          .where(
            attachmentCount
              ? and(
                  inArray(schema.files.id, attachmentIds),
                  eq(schema.files.owner_user_id, userId),
                  eq(schema.files.purpose, FILE_PURPOSE.message_attachment),
                  eq(schema.files.status, FILE_STATUS.validated)
                )
              : sql`false`
          )
      );

      const validatedAttachmentCount = db
        .$with("validated_attachment_count")
        .as(
          db
            .select({
              count: count().as("attachment_count"),
            })
            .from(validatedAttachments)
        );

      const validatedParentMessage = db.$with("validated_parent_message").as(
        db
          .select({
            id: replyParentMessage.id,
            user_id: replyParentMessage.user_id,
            content_text: replyParentMessage.content_text,
            created_at: replyParentMessage.created_at,
            edited_at: replyParentMessage.edited_at,
          })
          .from(replyParentMessage)
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

      const validatedChannel = db.$with("validated_channel").as(
        db
          .select({
            id: schema.channels.id,
          })
          .from(schema.channels)
          .leftJoin(validatedParentMessage, sql`true`)
          .crossJoin(validatedAttachmentCount)
          .where(
            and(
              eq(schema.channels.id, input.channelId),
              isNull(schema.channels.deleted_at),
              attachmentCount
                ? eq(validatedAttachmentCount.count, attachmentCount)
                : undefined,
              isReply ? isNotNull(validatedParentMessage.id) : undefined
            )
          )
      );

      const messageInsert = db.$with("message").as(
        db
          .insert(schema.messages)
          .values({
            content: input.content.html,
            content_text: input.content.text,
            user_id: ctx.user.id,
            channel_id: sql`(select ${validatedChannel.id} from ${validatedChannel})`, // the whole validation relies on this check
            reply_to_message_id: isReply
              ? sql`(select ${validatedParentMessage.id} from ${validatedParentMessage})`
              : null,
          })
          .returning(messageColumns)
      );

      const attachmentInsert = attachmentCount
        ? db.$with("message_attachment").as(
            db
              .insert(schema.message_attachments)
              .values(
                attachmentIds.map((fileId, index) => ({
                  message_id: sql`(select ${messageInsert.id} from ${messageInsert})`,
                  file_id: fileId,
                  sort_order: index,
                }))
              )
              .returning({
                file_id: schema.message_attachments.file_id,
                sort_order: schema.message_attachments.sort_order,
              })
          )
        : undefined;

      const attachedFilesUpdate = attachmentInsert
        ? db.$with("attached_files").as(
            db
              .update(schema.files)
              .set({
                status: FILE_STATUS.active,
              })
              .from(attachmentInsert)
              .where(eq(schema.files.id, attachmentInsert.file_id))
              .returning({
                id: schema.files.id,
                object_key: schema.files.object_key,
                original_name: schema.files.original_name,
                size_bytes: schema.files.size_bytes,
                extension: schema.files.extension,
                sort_order: attachmentInsert.sort_order,
              })
          )
        : undefined;

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

      const query = db
        .with(
          validatedAttachments,
          validatedAttachmentCount,
          validatedParentMessage,
          validatedChannel,
          messageInsert,
          ...(attachmentInsert ? [attachmentInsert] : []),
          ...(attachedFilesUpdate ? [attachedFilesUpdate] : []),
          parentMessageUpdate,
          channelUpdate
        )
        .select({
          message: pickByShape(messageInsert, messageColumns),
          attachment: attachedFilesUpdate
            ? {
                id: attachedFilesUpdate.id,
                object_key: attachedFilesUpdate.object_key,
                original_name: attachedFilesUpdate.original_name,
                size_bytes: attachedFilesUpdate.size_bytes,
                extension: attachedFilesUpdate.extension,
                sort_order: attachedFilesUpdate.sort_order,
              }
            : sql<null>`null`.as("attachment"),
          channel_messages_version: channelUpdate.messages_version,
          parent_message: {
            id: validatedParentMessage.id,
            contentPreview: leftText(
              validatedParentMessage.content_text,
              sharedMessagesValidations.messageContentPreviewMaxLength
            ),
            created_at: validatedParentMessage.created_at,
            edited_at: validatedParentMessage.edited_at,
            reply_count: parentMessageUpdate.reply_count,
          },
          parent_message_author: pickByShape(
            replyParentAuthor,
            messageAuthorColumns
          ),
        })
        .from(messageInsert)
        .innerJoin(channelUpdate, sql`true`)
        .leftJoin(parentMessageUpdate, sql`true`)
        .leftJoin(
          validatedParentMessage,
          eq(validatedParentMessage.id, messageInsert.reply_to_message_id)
        )
        .leftJoin(
          replyParentAuthor,
          eq(replyParentAuthor.id, validatedParentMessage.user_id)
        )
        .$dynamic();

      const rows = attachedFilesUpdate
        ? await query.leftJoin(attachedFilesUpdate, sql`true`)
        : await query;

      const newData = rows[0];

      if (!newData?.message || !newData.channel_messages_version) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const newMessage = newData.message as JoinedMessage;
      newMessage.author = author;
      newMessage.parentMessage =
        newData.parent_message.created_at &&
        newData.parent_message.edited_at &&
        newData.parent_message_author
          ? {
              author: newData.parent_message_author,
              contentPreview: newData.parent_message.contentPreview || "",
              created_at: newData.parent_message.created_at,
              edited_at: newData.parent_message.edited_at,
            }
          : null;
      newMessage.attachments = rows.flatMap((row) =>
        row.attachment?.id ? [row.attachment] : []
      );

      const parentMessageIdSerialized = newMessage.reply_to_message_id || null;

      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              ...newMessage,
              channel_id: newMessage.channel_id,
              id: newMessage.id,
              reply_to_message_id: parentMessageIdSerialized,
            },
            messagesVersion: newData.channel_messages_version,
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
          channelId: newMessage.channel_id,
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
          .set({
            content: input.content.html,
            content_text: input.content.text,
            edited_at: sql`now()`,
          })
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
          .returning({
            ...messageColumns,
            contentPreview: leftText(
              schema.messages.content_text,
              sharedMessagesValidations.messageContentPreviewMaxLength
            ).as("contentPreview"),
          })
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
      if (!updatedData?.message) throw new TRPCError({ code: "NOT_FOUND" });

      const updatedMessage = updatedData.message;

      waitUntil(
        publishChannelEvent({
          data: {
            message: {
              content: updatedMessage.content,
              contentPreview: updatedMessage.contentPreview,
              id: updatedMessage.id,
              reply_count: updatedMessage.reply_count,
              edited_at: updatedMessage.edited_at,
            },
            messagesVersion: updatedData.channel.messages_version,
          },
          eventName: "messages:update",
          channelId: updatedMessage.channel_id,
        }).catch((e) => console.error("Ably message update publish failed", e))
      );
      return {
        message: {
          content: updatedMessage.content,
          contentPreview: updatedMessage.contentPreview,
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
          .returning(messageColumns)
      );

      const attachedFilesUpdate = db.$with("attached_files").as(
        db
          .update(schema.files)
          .set({ status: FILE_STATUS.deleted })
          .from(schema.message_attachments)
          .where(
            and(
              eq(schema.files.id, schema.message_attachments.file_id),
              eq(
                schema.message_attachments.message_id,
                db.select({ id: messageUpdate.id }).from(messageUpdate)
              ),
              eq(schema.files.owner_user_id, ctx.user.id),
              eq(schema.files.status, FILE_STATUS.active)
            )
          )
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
        .with(
          messageUpdate,
          attachedFilesUpdate,
          channelUpdate,
          parentMessageUpdate
        )
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
              id: updatedMessage.id,
            },
            messagesVersion: updatedData.channel.messages_version,
            parentMessageUpdate:
              parentMessage?.id && typeof parentMessage.reply_count === "number"
                ? {
                    reply_count: parentMessage.reply_count,
                    id: parentMessage.id,
                  }
                : null,
          },
          eventName: "messages:delete",
          channelId: updatedMessage.channel_id,
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
        items: z.custom<ReplyMessage[]>(),
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

      const { content: _content, ...replyMessageColumnsBase } = messageColumns;

      const rows = await db
        .select({
          totalItems: parentMessage.reply_count,
          message: {
            ...replyMessageColumnsBase,
            contentPreview: leftText(
              schema.messages.content_text,
              sharedMessagesValidations.messageContentPreviewMaxLength
            ),
          },
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
      const items: ReplyMessage[] = [];

      for (const row of rows) {
        if (!row.message?.id || !row.author?.id) continue;

        let newItem = row.message as ReplyMessage;
        newItem.author = row.author as ReplyMessage["author"];
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
