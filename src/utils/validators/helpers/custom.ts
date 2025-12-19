import z from "zod";
import { Dayjs } from "dayjs";

import dayjs from "@/utils/dayjs";

export const zDayjs = z.custom<Dayjs>((v) => dayjs.isDayjs(v) && v.isValid(), {
  error: "Invalid date",
});
