import z from "zod";

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
