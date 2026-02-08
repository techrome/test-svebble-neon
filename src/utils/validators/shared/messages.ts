import { Text } from "@/utils/validators/helpers/text";
import z from "zod";

export const messageIdSchema = z.bigint().positive();
export const messageIdQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((val) => BigInt(val));

export const messagesGetSchemaForm = z.object({
  limit: z
    .int()
    .min(2)
    .max(50)
    .refine((val) => val % 2 === 0, "Must be an even integer")
    .default(30),
  around: messageIdQuerySchema.optional(),
  cursor: messageIdSchema.optional(),
  direction: z.enum(["forward", "backward"]).optional(),
});

export const messageCreateSchemaForm = z.object({
  content: z.string(),
});
export const makeMessageCreateSchemaForm = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm.safeExtend({
    content: Text[isVerifiedUser ? "Long" : "Short"]({ required: true }),
  });

export const messageUpdateSchemaForm = messageCreateSchemaForm.extend({
  id: messageIdSchema,
});
export const makeMessageUpdateSchemaForm = (isVerifiedUser?: boolean) =>
  makeMessageCreateSchemaForm(isVerifiedUser).extend({
    id: messageUpdateSchemaForm.shape.id,
  });

export const messageDeleteSchemaForm = messageUpdateSchemaForm.pick({
  id: true,
});

export type MessageCreateFormValues = z.infer<
  ReturnType<typeof makeMessageCreateSchemaForm>
>;
