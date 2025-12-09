import { hasText } from "@/utils/stringUtils";

export const hasMeaningfulValue = (value: unknown): boolean => {
  if (typeof value === "string") return hasText(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return !Number.isNaN(value);

  return Boolean(value);
};

export const countMeaningfulValues = (obj: object): number => {
  return Object.values(obj).filter((val) => hasMeaningfulValue(val)).length;
};
