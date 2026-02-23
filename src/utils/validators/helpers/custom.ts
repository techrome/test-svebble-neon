import z from "zod";
import { Dayjs } from "dayjs";

import dayjs from "@/utils/dayjs";

export const zDayjs = z.custom<Dayjs>((v) => dayjs.isDayjs(v) && v.isValid(), {
  error: "Invalid date",
});

export const numericIdSchema = z.bigint().positive();
export const numericIdQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((val) => BigInt(val));

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
