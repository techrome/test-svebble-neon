import {
  numericIdQuerySchema,
  numericIdSchema,
} from "@/utils/validators/helpers/custom";
import { Text } from "@/utils/validators/helpers/text";
import z from "@/utils/zod";

export const messagesGetWebsocketsToken = z.object({
  channelId: numericIdQuerySchema,
});

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
      direction: z.enum(["forward", "backward"]).optional(),
      id: numericIdSchema.optional(),
    })
    .optional(),
  direction: z.enum(["forward", "backward"]).optional(),
});

export const messageCreateSchemaForm = z.object({
  content: z.string(),
  channelId: numericIdSchema,
});
export const makeMessageCreateSchemaForm = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm.safeExtend({
    content: Text[isVerifiedUser ? "Long" : "Short"]({ required: true }),
  });

export const messageUpdateSchemaForm = messageCreateSchemaForm
  .omit({ channelId: true })
  .extend({
    id: numericIdSchema,
  });
export const makeMessageUpdateSchemaForm = (isVerifiedUser?: boolean) =>
  messageUpdateSchemaForm.safeExtend({
    content: Text[isVerifiedUser ? "Long" : "Short"]({ required: true }),
  });

export const messageDeleteSchemaForm = messageUpdateSchemaForm.pick({
  id: true,
});

export const messageBulkDeleteSchemaForm = messageCreateSchemaForm.pick({
  channelId: true,
});

export type MessageCreateFormValues = z.infer<
  ReturnType<typeof makeMessageCreateSchemaForm>
>;
