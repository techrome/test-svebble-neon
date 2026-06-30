import z from "@/utils/zod";
import { Dayjs } from "dayjs";

import dayjs from "@/utils/dayjs";
import { isOneOf } from "@/utils/stringUtils";

export const zDayjs = z.custom<Dayjs>((v) => dayjs.isDayjs(v) && v.isValid(), {
  error: "Invalid date",
});

export const numericIdSchema = z.int().min(0);
export const versionSchema = z.int().min(0);

type ZodShape = z.ZodRawShape;
type MaskFor<TShape extends ZodShape> = Partial<Record<keyof TShape, true>>;

export const omitStrict = <S extends ZodShape, M extends MaskFor<S>>(
  schema: z.ZodObject<S>,
  mask: M
) => {
  return schema.omit(mask);
};

export const extendExisting = <
  S extends ZodShape,
  O extends Partial<Record<keyof S, z.ZodType>>,
>(
  schema: z.ZodObject<S>,
  overrides: O
) => {
  return schema.extend(overrides);
};

export const toObject = <T extends readonly string[]>(arr: T) =>
  Object.fromEntries(arr.map((val) => [val, val])) as {
    readonly [K in T[number]]: K;
  };

export const getFileExtension = <T>(
  filename: string,
  allowedExtensions: T[]
): T | null => {
  if (!filename) return null;
  const extension = filename.split(".").pop()?.trim().toLowerCase();
  return allowedExtensions.find((allowed) => allowed === extension) || null;
};

const INVALID_FILENAME_CHARS_RE = /[<>:"\/\\|?*\x00-\x1F]/g;

export const getFileName = (filename: string): string | null => {
  const trimmed = filename.trim().replace(INVALID_FILENAME_CHARS_RE, "");
  if (!trimmed) return null;

  const lastDotIndex = trimmed.lastIndexOf(".");
  if (lastDotIndex <= 0) return trimmed;

  const name = trimmed.slice(0, lastDotIndex).trim();

  return name || null;
};

export const allowedEmailDomains = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "yahoo.com",
  "proton.me",
  "protonmail.com",
] as const;

export const canonicalizeEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();

  const [rawLocal, rawDomain] = normalized.split("@");

  if (!rawLocal || !rawDomain) {
    return normalized;
  }

  let local = rawLocal;
  let domain = rawDomain;

  if (
    isOneOf(domain, [
      "gmail.com",
      "proton.me",
      "protonmail.com",
    ] satisfies (typeof allowedEmailDomains)[number][])
  ) {
    local = local.replace(/[._\-]/g, "");
  }

  return `${local}@${domain}`;
};

export const getEmailDomain = (email: string) =>
  email.split("@").at(-1)?.toLowerCase() || "";
