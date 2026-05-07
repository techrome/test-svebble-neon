import {
  numericIdQuerySchema,
  numericIdSchema,
} from "@/utils/validators/helpers/custom";
import z from "@/utils/zod";

export const messageContentPreviewMaxLength = 100;
export const messageRepliesPageMaxSize = 20;

export const messagesGetWebsocketsToken = z.object({
  channelId: numericIdQuerySchema,
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
  around: numericIdQuerySchema.optional(),
  channelId: numericIdQuerySchema,
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
});

export const messageUpdateSchemaForm = messageCreateSchemaForm
  .pick({ content: true })
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
  messageId: numericIdQuerySchema,
  page: z.int().positive(),
  pageSize: z
    .int()
    .positive()
    .max(messageRepliesPageMaxSize)
    .default(messageRepliesPageMaxSize),
});
