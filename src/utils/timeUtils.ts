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

export const isWithinPeriod = (
  a: Dayjs,
  b: Dayjs,
  unit: QUnitType | OpUnitType,
  diff: number
) => Math.abs(a.diff(b, unit, true)) <= diff;

// faster alternative for hot paths
export const isWithinMs = (a: Date, b: Date, diff: number) =>
  Math.abs(a.getTime() - b.getTime()) <= diff;

export const isWithinMinute = (a: Dayjs, b: Dayjs) =>
  isWithinPeriod(a, b, "minute", 1);
