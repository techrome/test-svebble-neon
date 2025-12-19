import { logger } from "@/utils/logger";
import { Dayjs, OpUnitType, QUnitType } from "dayjs";

export const toISOString = (date: Dayjs) => {
  if (date) {
    return date.toISOString();
  } else {
    logger.warn("toISOString got invalid date: ", date);
    return "";
  }
};

const getTimeDiff = (
  a: Dayjs,
  b: Dayjs,
  unit: QUnitType | OpUnitType,
  diff: number
) => Math.abs(a.diff(b, unit, true)) <= diff;

export const sameWithinMinute = (a: Dayjs, b: Dayjs) =>
  getTimeDiff(a, b, "minute", 1);
