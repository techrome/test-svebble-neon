import { htmlToText } from "@/utils/htmlToText";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";
import {
  messageCreateSchemaForm,
  messageUpdateSchemaForm,
} from "@/utils/validators/shared/messages";
import { z } from "@/utils/zod";

export const getMessageContentMaxLength = (isVerifiedUser?: boolean) =>
  isVerifiedUser ? TEXT_LIMITS.long : TEXT_LIMITS.short;

const contentSchema = (isVerifiedUser?: boolean) =>
  z
    .string()
    .transform((html) => {
      const text = htmlToText(html);

      return { text, html };
    })
    .superRefine(({ text, html }, ctx) => {
      if (!text && !html) return;

      const textMaxLength = getMessageContentMaxLength(isVerifiedUser);
      const htmlMaxLength = TEXT_LIMITS.long * 4;

      if (text.length > textMaxLength) {
        ctx.addIssue({
          code: "too_big",
          message: `Message content must not be greater than ${textMaxLength} characters`,
          maximum: textMaxLength,
          origin: "number",
        });
        return;
      }
      if (html.length > htmlMaxLength) {
        ctx.addIssue({
          code: "too_big",
          message: `Message content total HTML must not be greater than ${htmlMaxLength} characters`,
          maximum: htmlMaxLength,
          origin: "number",
        });
        return;
      }
    })
    .transform((v) => v.html);

type MessageFormData = {
  content: string;
  attachmentIds: readonly unknown[];
};

const requireContentOrAttachments = (
  data: MessageFormData,
  ctx: z.RefinementCtx
) => {
  const hasContent = Boolean(data.content);
  const hasAttachments = data.attachmentIds.length > 0;

  if (!hasContent && !hasAttachments) {
    ctx.addIssue({
      code: "custom",
      path: ["content"],
      message: "Message cannot be empty",
    });
    return;
  }
};

export type MessageCreateFormValues = z.input<
  ReturnType<typeof makeMessageCreateSchemaForm>
>;

export const makeMessageCreateSchemaForm = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm
    .safeExtend({
      content: contentSchema(isVerifiedUser),
    })
    .superRefine(requireContentOrAttachments);

export const makeMessageUpdateSchemaForm = (isVerifiedUser?: boolean) =>
  messageUpdateSchemaForm
    .safeExtend({
      content: contentSchema(isVerifiedUser),
    })
    .superRefine(requireContentOrAttachments);
