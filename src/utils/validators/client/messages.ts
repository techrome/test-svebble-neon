import { htmlToText } from "@/utils/htmlToText";
import { Text, TEXT_LIMITS } from "@/utils/validators/helpers/text";
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
    .min(1, { error: "Message content is required" })
    .transform((fullHtml) => {
      const htmlText = htmlToText(fullHtml);

      return { htmlText, fullHtml };
    })
    .superRefine(({ htmlText, fullHtml }, ctx) => {
      const textMaxLength = getMessageContentMaxLength(isVerifiedUser);
      const htmlMaxLength = TEXT_LIMITS.long * 4;
      if (!htmlText || !fullHtml) {
        ctx.addIssue({
          code: "custom",
          message: "Message content is required",
        });
        return;
      }
      if (htmlText.length > textMaxLength) {
        ctx.addIssue({
          code: "too_big",
          message: `Message content must not be greater than ${textMaxLength} characters`,
          maximum: textMaxLength,
          origin: "number",
        });
        return;
      }
      if (fullHtml.length > htmlMaxLength) {
        ctx.addIssue({
          code: "too_big",
          message: `Message content total HTML must not be greater than ${htmlMaxLength} characters`,
          maximum: htmlMaxLength,
          origin: "number",
        });
        return;
      }
    })
    .transform((v) => v.fullHtml);

export const makeMessageCreateSchemaForm = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm.safeExtend({
    content: contentSchema(isVerifiedUser),
  });

export type MessageCreateFormValues = z.infer<
  ReturnType<typeof makeMessageCreateSchemaForm>
>;

export const makeMessageUpdateSchemaForm = (isVerifiedUser?: boolean) =>
  messageUpdateSchemaForm.safeExtend({
    content: contentSchema(isVerifiedUser),
  });
