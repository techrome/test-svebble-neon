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

export const hashString32 = (str: string) => {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    result = (result * 31 + str.charCodeAt(i)) | 0;
  }
  return result;
};
