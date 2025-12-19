import { logger } from "@/utils/logger";

export const normalizeText = (val: string) => {
  if (typeof val !== "string") {
    logger.warn("normalizeText value was not string, it was: ", typeof val);
    return "";
  }
  return val.trim();
};

export const hasText = (val: string) => {
  return Boolean(normalizeText(val));
};
