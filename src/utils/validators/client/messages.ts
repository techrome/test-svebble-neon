import { htmlToText } from "@/utils/htmlToText";
import { Text } from "@/utils/validators/helpers/text";
import {
  messageCreateSchemaForm,
  messageUpdateSchemaForm,
} from "@/utils/validators/shared/messages";
import { z } from "@/utils/zod";

export const makeMessageCreateSchemaForm = (isVerifiedUser?: boolean) =>
  messageCreateSchemaForm.safeExtend({
    content: Text[isVerifiedUser ? "Long" : "Short"]({ required: true }).refine(
      (v) => Boolean(htmlToText(v).trim()),
      "Field is required"
    ),
  });

export type MessageCreateFormValues = z.infer<
  ReturnType<typeof makeMessageCreateSchemaForm>
>;

export const makeMessageUpdateSchemaForm = (isVerifiedUser?: boolean) =>
  messageUpdateSchemaForm.safeExtend({
    content: Text[isVerifiedUser ? "Long" : "Short"]({ required: true }).refine(
      (v) => Boolean(htmlToText(v).trim()),
      "Field is required"
    ),
  });
