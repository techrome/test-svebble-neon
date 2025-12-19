import { Text, TEXT_LIMITS } from "@/utils/validators/helpers/text";
import z from "zod";

const commentTextSchema = Text.Short.min(1);
const idSchema = z.string().nonempty();

export const commentsCreate = z.object({
  text: commentTextSchema,
});
export const commentsUpdate = z.object({
  id: idSchema,
  text: commentTextSchema,
});
export const commentsDelete = z.object({
  id: idSchema,
});
