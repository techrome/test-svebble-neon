import { numericIdSchema } from "@/utils/validators/helpers/custom";
import { Text } from "@/utils/validators/helpers/text";
import z from "@/utils/zod";

export const channelCreateSchemaForm = z.object({
  name: Text.Title({ required: true }),
});
// eslint-disable-next-line
export const makeChannelCreateSchemaForm = (isVerifiedUser?: boolean) =>
  channelCreateSchemaForm;

export const channelUpdateSchemaForm = channelCreateSchemaForm.extend({
  id: numericIdSchema,
});
export const makeChannelUpdateSchemaForm = (isVerifiedUser?: boolean) =>
  makeChannelCreateSchemaForm(isVerifiedUser).extend({
    id: channelUpdateSchemaForm.shape.id,
  });

export const channelDeleteSchemaForm = channelUpdateSchemaForm.pick({
  id: true,
});

export type ChannelCreateFormValues = z.infer<
  ReturnType<typeof makeChannelCreateSchemaForm>
>;
