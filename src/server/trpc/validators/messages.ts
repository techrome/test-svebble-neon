import * as htmlparser2 from "htmlparser2";

import { sanitizeMessageHtml, trimHtml } from "../../utils/sanitizeHtml";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";
import { numericIdSchema } from "@/utils/validators/helpers/custom";
import { messageCreateSchemaForm } from "@/utils/validators/shared/messages";
import { z } from "@/utils/zod";
import { getMessageContentMaxLength } from "@/utils/validators/client/messages";

const contentSchema = (isVerifiedUser?: boolean) =>
  z
    .string()
    .min(1, { error: "Message content is required" })
    .transform((v) => {
      const sanitizedHtml = sanitizeMessageHtml(v);
      const parsedDocument = htmlparser2.parseDocument(sanitizedHtml);
      const htmlText = htmlparser2.DomUtils.textContent(parsedDocument).trim();
      const trimmedHtml = trimHtml(parsedDocument).trim();

      return { htmlText, trimmedHtml };
    })
    .superRefine(({ htmlText, trimmedHtml }, ctx) => {
      const textMaxLength = getMessageContentMaxLength(isVerifiedUser);
      const htmlMaxLength = TEXT_LIMITS.long * 4;

      if (!htmlText || !trimmedHtml) {
        ctx.addIssue({
          code: "custom",
          message: "Message content is required",
        });
        return;
      }
      if (htmlText.length > textMaxLength) {
        ctx.addIssue({
          code: "custom",
          message: `Message content must not be greater than ${textMaxLength} characters`,
        });
        return;
      }
      if (trimmedHtml.length > htmlMaxLength) {
        ctx.addIssue({
          code: "custom",
          message: `Message content total HTML must not be greater than ${htmlMaxLength} characters`,
        });
        return;
      }
    })
    .transform((v) => v.trimmedHtml);

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
