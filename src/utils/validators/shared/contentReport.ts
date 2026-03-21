import z from "@/utils/zod";

import { numericIdSchema, toObject } from "@/utils/validators/helpers/custom";
import { Text } from "@/utils/validators/helpers/text";

export const CONTENT_REPORT_REASON_ENUM = [
  "harassment_hate",
  "nsfw",
  "harmful_dangerous",
  "spam_deceptive",
  "privacy_personal",
  "other",
] as const;
export const CONTENT_REPORT_REASON = toObject(CONTENT_REPORT_REASON_ENUM);
export const contentReportReasonSchema = z.enum(CONTENT_REPORT_REASON_ENUM);
export type ContentReportReason = z.infer<typeof contentReportReasonSchema>;

export const contentReportReasonOptions = [
  {
    value: CONTENT_REPORT_REASON.harassment_hate,
    label: "Harassment or hate",
    description:
      "Bullying, targeted abuse, or hate speech directed at a person or group.",
  },
  {
    value: CONTENT_REPORT_REASON.nsfw,
    label: "Sexual or explicit content",
    description: "Sexual content, nudity, or other explicit content.",
  },
  {
    value: CONTENT_REPORT_REASON.harmful_dangerous,
    label: "Violence or dangerous content",
    description:
      "Violent threats, graphic violence, self-harm, or content promoting dangerous acts.",
  },
  {
    value: CONTENT_REPORT_REASON.spam_deceptive,
    label: "Spam, phishing, or impersonation",
    description: "Spam, phishing, scam, impersonation, or misleading content.",
  },
  {
    value: CONTENT_REPORT_REASON.privacy_personal,
    label: "Personal information or privacy violation",
    description:
      "Doxxing, sharing private information, or non-consensual private content.",
  },
  {
    value: CONTENT_REPORT_REASON.other,
    label: "Other",
    description: "Something else that violates the rules.",
  },
] as const satisfies {
  value: ContentReportReason;
  label: string;
  description: string;
}[];

export const messageReportSchema = z
  .object({
    messageId: numericIdSchema,
    reason: contentReportReasonSchema,
    additionalInfo: Text.Short(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === CONTENT_REPORT_REASON.other && !data.additionalInfo) {
      ctx.addIssue({
        code: "custom",
        path: ["additionalInfo"] satisfies (keyof typeof data)[],
        message: "Please provide additional information.",
      });
    }
  });
