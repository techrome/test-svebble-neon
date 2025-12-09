import { logger } from "@/utils/logger";
import { Dayjs } from "dayjs";

export const toISOString = (date: Dayjs) => {
  if (date) {
    return date.toISOString();
  } else {
    logger.warn("toISOString got invalid date: ", date);
    return "";
  }
};
