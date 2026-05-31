import * as htmlparser2 from "htmlparser2";

import {
  htmlToText,
  sanitizeMessageHtml,
  trimHtml,
} from "../../utils/sanitizeHtml";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";
import { numericIdSchema } from "@/utils/validators/helpers/custom";
import { messageCreateSchemaForm } from "@/utils/validators/shared/messages";
import { z } from "@/utils/zod";
import { getMessageContentMaxLength } from "@/utils/validators/client/messages";

export const messageContentHtmlMaxLength = TEXT_LIMITS.long * 4;

const contentSchema = (isVerifiedUser?: boolean) =>
  z
    .string()
    .transform((v) => {
      const sanitizedHtml = sanitizeMessageHtml(v);
      const parsedDocument = htmlparser2.parseDocument(sanitizedHtml);
      const text = htmlToText(sanitizedHtml);
      const html = trimHtml(parsedDocument).trim();

      return { text, html };
    })
    .superRefine(({ text, html }, ctx) => {
      if (!text && !html) return;

      const textMaxLength = getMessageContentMaxLength(isVerifiedUser);
      const htmlMaxLength = messageContentHtmlMaxLength;

      if (text.length > textMaxLength) {
        ctx.addIssue({
          code: "custom",
          message: `Message content must not be greater than ${textMaxLength} characters`,
        });
        return;
      }
      if (html.length > htmlMaxLength) {
        ctx.addIssue({
          code: "custom",
          message: `Message content total HTML must not be greater than ${htmlMaxLength} characters`,
        });
        return;
      }
    });

type MessageFormData = {
  content: { text: string; html: string };
  attachmentIds: unknown[];
};

const requireContentOrAttachments = (
  data: MessageFormData,
  ctx: z.RefinementCtx
) => {
  const hasContent = Boolean(data.content.html && data.content.text);
  const hasAttachments = data.attachmentIds.length > 0;

  if (!hasContent && !hasAttachments) {
    ctx.addIssue({
      code: "custom",
      message: "Message cannot be empty",
    });
    return;
  }
};

export const makeMessageCreateSchema = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm
    .extend({
      content: contentSchema(isVerifiedUser),
    })
    .superRefine(requireContentOrAttachments);

export const messageUpdateSchema = messageCreateSchemaForm
  .pick({ content: true, attachmentIds: true })
  .extend({
    id: numericIdSchema,
  });

export const makeMessageUpdateSchema = (isVerifiedUser?: boolean) =>
  messageUpdateSchema
    .extend({
      content: contentSchema(isVerifiedUser),
    })
    .superRefine(requireContentOrAttachments);
