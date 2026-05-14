export const AVATAR_MAX_SIZE_KB = 128;
export const AVATAR_MAX_WIDTH = 256;
export const AVATAR_MAX_HEIGHT = 256;

export const allowedAvatarExtensionsMap = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export const allowedAvatarExtensions = Object.keys(
  allowedAvatarExtensionsMap
) as (keyof typeof allowedAvatarExtensionsMap)[];

export const allowedAvatarMimeTypes = [
  ...new Set(Object.values(allowedAvatarExtensionsMap)),
];
