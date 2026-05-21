import { avatarUploadUrlSchemaClient } from "@/utils/validators/client/user";
import { allowedAvatarExtensionsMap } from "@/utils/validators/sharedValues/user";
import { z } from "@/utils/zod";

export const avatarUploadUrlSchemaServer = z.object({
  ...avatarUploadUrlSchemaClient.shape,
  imageExtension: z.literal(
    "jpg" satisfies keyof typeof allowedAvatarExtensionsMap,
    { error: "Unsupported image type." }
  ),
} satisfies Record<keyof typeof avatarUploadUrlSchemaClient.shape, z.ZodType>);
