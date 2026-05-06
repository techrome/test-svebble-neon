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
    .min(1, { error: "Message content is required" })
    .transform((v) => {
      const sanitizedHtml = sanitizeMessageHtml(v);
      const parsedDocument = htmlparser2.parseDocument(sanitizedHtml);
      const text = htmlToText(sanitizedHtml);
      const html = trimHtml(parsedDocument).trim();

      return { text, html };
    })
    .superRefine(({ text, html }, ctx) => {
      const textMaxLength = getMessageContentMaxLength(isVerifiedUser);
      const htmlMaxLength = messageContentHtmlMaxLength;

      if (!text || !html) {
        ctx.addIssue({
          code: "custom",
          message: "Message content is required",
        });
        return;
      }
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

export const makeMessageCreateSchema = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm.extend({
    content: contentSchema(isVerifiedUser),
  });

export const messageUpdateSchema = messageCreateSchemaForm
  .pick({ content: true })
  .extend({
    id: numericIdSchema,
  });

export const makeMessageUpdateSchema = (isVerifiedUser?: boolean) =>
  messageUpdateSchema.extend({
    content: contentSchema(isVerifiedUser),
  });
