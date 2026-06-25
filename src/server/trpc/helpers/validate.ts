import { TRPCError } from "@trpc/server";
import z from "@/utils/zod";
import { allowedMessageAttachmentExtensions } from "@/utils/validators/sharedValues/messages";

export const throwIfZodError: <TInput>(
  parseResult: z.ZodSafeParseResult<TInput>
) => asserts parseResult is z.ZodSafeParseSuccess<TInput> = (parseResult) => {
  if (!parseResult.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      cause: parseResult.error,
    });
  }
};

const uuidSchema = z.uuid();
const uuidRegex = "([0-9a-fA-F-]{36})";
const buildUserFileRegex = (allowedExtensions: string[]) =>
  new RegExp(
    `^users/${uuidRegex}/${uuidRegex}\\.(?:${allowedExtensions.join("|")})$`,
    "i"
  );
export const validateUserFileKey = (
  userId: string,
  key: string,
  allowedExtensions: string[]
): boolean => {
  const regex = buildUserFileRegex(allowedExtensions);
  const match = regex.exec(key);
  if (!match) return false;

  const [, ownerId, fileId] = match;

  return ownerId === userId && uuidSchema.safeParse(fileId).success;
};

type AllowedMessageAttachmentExtensions =
  typeof allowedMessageAttachmentExtensions;

export const validateMessageAttachmentExtension = (
  nonVerifiedExtension: AllowedMessageAttachmentExtensions[number],
  realExtension: string
): boolean => {
  const containerLikeExts: AllowedMessageAttachmentExtensions = [
    "docx",
    "xlsx",
  ];
  const jpegExts: AllowedMessageAttachmentExtensions = ["jpg", "jpeg"];

  if (
    containerLikeExts.includes(nonVerifiedExtension) &&
    realExtension === "zip"
  ) {
    return true;
  }
  if (jpegExts.includes(nonVerifiedExtension) && realExtension === "jpg") {
    return true;
  }

  return nonVerifiedExtension === realExtension;
};
