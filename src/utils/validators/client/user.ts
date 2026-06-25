import { kilobytes } from "@/utils/storageUnits";
import {
  allowedAvatarExtensions,
  AVATAR_MAX_HEIGHT,
  AVATAR_MAX_SIZE_KB,
  AVATAR_MAX_WIDTH,
} from "@/utils/validators/sharedValues/user";
import z from "@/utils/zod";

export const avatarUploadUrlSchemaClient = z.object({
  imageExtension: z
    .string()
    .nullable()
    .pipe(
      z.enum(allowedAvatarExtensions, {
        error: "Unsupported image type.",
      })
    ),
  imageSize: z
    .number()
    .int()
    .positive()
    .max(kilobytes(AVATAR_MAX_SIZE_KB), {
      error: `Image size must be less than ${AVATAR_MAX_SIZE_KB}KB.`,
    }),
  imageWidth: z
    .number()
    .int()
    .positive()
    .max(AVATAR_MAX_WIDTH, {
      error: `Image width must be less than ${AVATAR_MAX_WIDTH} pixels.`,
    }),
  imageHeight: z
    .number()
    .int()
    .positive()
    .max(AVATAR_MAX_HEIGHT, {
      error: `Image height must be less than ${AVATAR_MAX_HEIGHT} pixels.`,
    }),
});
