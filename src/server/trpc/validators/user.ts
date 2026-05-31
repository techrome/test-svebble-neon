import { avatarUploadUrlSchemaClient } from "@/utils/validators/client/user";
import { allowedAvatarExtensionsMap } from "@/utils/validators/sharedValues/user";
import { z } from "@/utils/zod";

export const allowedAvatarExtensionsServer = [
  "jpg",
] as const satisfies (keyof typeof allowedAvatarExtensionsMap)[];

export const avatarUploadUrlSchemaServer = z.object({
  ...avatarUploadUrlSchemaClient.shape,
  imageExtension: z.enum(allowedAvatarExtensionsServer, {
    error: "Unsupported image type.",
  }),
} satisfies Record<keyof typeof avatarUploadUrlSchemaClient.shape, z.ZodType>);
