import z from "zod";

const commentTextSchema = z.string().min(1).max(255);
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
