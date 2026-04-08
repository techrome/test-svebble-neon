import { sanitizeMessageHtml, trimHtml } from "../../utils/sanitizeHtml";
import { Text } from "@/utils/validators/helpers/text";
import { numericIdSchema } from "@/utils/validators/helpers/custom";
import { messageCreateSchemaForm } from "@/utils/validators/shared/messages";

const contentSchema = (isVerifiedUser?: boolean) =>
  Text[isVerifiedUser ? "Long" : "Short"]({ required: true })
    .transform((v) => trimHtml(sanitizeMessageHtml(v)))
    .refine((sanitizedHtml) => Boolean(sanitizedHtml), {
      message: "Message cannot be empty",
    });

export const makeMessageCreateSchema = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm.safeExtend({
    content: contentSchema(isVerifiedUser),
  });

export const messageUpdateSchema = messageCreateSchemaForm
  .omit({ channelId: true })
  .extend({
    id: numericIdSchema,
  });

export const makeMessageUpdateSchema = (isVerifiedUser?: boolean) =>
  messageUpdateSchema.safeExtend({
    content: contentSchema(isVerifiedUser),
  });
