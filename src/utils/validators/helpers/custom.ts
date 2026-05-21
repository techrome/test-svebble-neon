import z from "@/utils/zod";
import { Dayjs } from "dayjs";

import dayjs from "@/utils/dayjs";

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

export const getFileExtension = (
  filename: string,
  allowedExtensions: string[]
): string | null => {
  if (!filename) return null;
  const extension = filename.split(".").pop()?.trim().toLowerCase();
  if (extension && allowedExtensions.includes(extension)) {
    return extension;
  }
  return null;
};
