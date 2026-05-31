import { megabytes } from "@/utils/storageUnits";
import {
  getFileName,
  numericIdSchema,
} from "@/utils/validators/helpers/custom";
import { Text } from "@/utils/validators/helpers/text";
import {
  allowedMessageAttachmentExtensions,
  MESSAGE_ATTACHMENT_IMAGE_MAX_PIXELS,
  MESSAGE_ATTACHMENT_MAX_COUNT,
  MESSAGE_ATTACHMENT_MAX_SIZE_MB,
} from "@/utils/validators/sharedValues/messages";
import z from "@/utils/zod";

export const messageContentPreviewMaxLength = 100;
export const messageRepliesPageMaxSize = 20;

export const messagesGetWebsocketsToken = z.object({
  channelId: numericIdSchema,
});

export const infiniteListDirectionSchema = z
  .enum(["forward", "backward"])
  .optional();

export const messagesGetSchemaForm = z.object({
  limit: z
    .int()
    .min(2)
    .max(50)
    .refine((val) => val % 2 === 0, "Must be an even integer")
    .default(30),
  around: numericIdSchema.optional(),
  channelId: numericIdSchema,
  cursor: z
    .object({
      direction: infiniteListDirectionSchema,
      id: numericIdSchema.optional(),
    })
    .optional(),
});

export const messageCreateSchemaForm = z.object({
  content: z.string(),
  channelId: numericIdSchema,
  reply_to_message_id: numericIdSchema.optional().nullable(),
  attachmentIds: z
    .array(z.uuid())
    .max(MESSAGE_ATTACHMENT_MAX_COUNT)
    .default([]),
});

export const messageUpdateSchemaForm = messageCreateSchemaForm
  .pick({ content: true, attachmentIds: true })
  .extend({
    id: numericIdSchema,
  });

export const messageDeleteSchemaForm = messageUpdateSchemaForm.pick({
  id: true,
});

export const messageBulkDeleteSchemaForm = messageCreateSchemaForm.pick({
  channelId: true,
});

export const messagesGetRepliesSchemaForm = z.object({
  messageId: numericIdSchema,
  page: z.int().positive(),
  pageSize: z
    .int()
    .positive()
    .max(messageRepliesPageMaxSize)
    .default(messageRepliesPageMaxSize),
});

export const createMessageAttachmentUploadUrlSchema = z.object({
  fileName: z
    .string()
    .transform((v) => getFileName(v))
    .pipe(Text.FileName({ required: true })),
  fileExtension: z
    .string()
    .nullable()
    .pipe(
      z.enum(allowedMessageAttachmentExtensions, {
        error: "Unsupported file type.",
      })
    ),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(megabytes(MESSAGE_ATTACHMENT_MAX_SIZE_MB), {
      error: `File size must be less than ${MESSAGE_ATTACHMENT_MAX_SIZE_MB}MB.`,
    }),
});

const imageMaxDimension = z
  .int()
  .positive()
  .max(MESSAGE_ATTACHMENT_IMAGE_MAX_PIXELS, {
    error: `Image dimensions must be less than ${MESSAGE_ATTACHMENT_IMAGE_MAX_PIXELS} pixels.`,
  });

export const messageAttachmentImageSchema = z.object({
  width: imageMaxDimension,
  height: imageMaxDimension,
});

export const finalizeMessageAttachmentSchema = z.object({
  fileObjectKey: Text.Long({ required: true }),
});
