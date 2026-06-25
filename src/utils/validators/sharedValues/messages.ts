import { allowedAvatarExtensionsMap } from "@/utils/validators/sharedValues/user";

export const MESSAGE_ATTACHMENT_MAX_SIZE_MB = 10;
export const MESSAGE_ATTACHMENT_MAX_COUNT = 10;
export const MESSAGE_ATTACHMENT_IMAGE_MAX_PIXELS = 8000;

export const allowedMessageAttachmentImageExtensionsMap = {
  ...allowedAvatarExtensionsMap,
  gif: "image/gif",
} as const;

export const allowedMessageAttachmentExtensionsMap = {
  ...allowedMessageAttachmentImageExtensionsMap,
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  rar: "application/vnd.rar",
} as const;

type MessageAttachmentImage =
  keyof typeof allowedMessageAttachmentImageExtensionsMap;

export const allowedMessageAttachmentImageExtensions = Object.keys(
  allowedMessageAttachmentImageExtensionsMap
) as (keyof typeof allowedMessageAttachmentImageExtensionsMap)[];

export const isImageExtension = (
  extension: string | null
): extension is MessageAttachmentImage => {
  return allowedMessageAttachmentImageExtensions.includes(
    extension as MessageAttachmentImage
  );
};

export const allowedMessageAttachmentExtensions = Object.keys(
  allowedMessageAttachmentExtensionsMap
) as (keyof typeof allowedMessageAttachmentExtensionsMap)[];

export const allowedMessageAttachmentMimeTypes = [
  ...new Set(Object.values(allowedMessageAttachmentExtensionsMap)),
];

export const allowedMessageAttachmentExtensionsDropzone =
  allowedMessageAttachmentExtensions.map((x) => "." + x);
