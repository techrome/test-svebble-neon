/* eslint-disable */
import z from "@/utils/zod";

import dayjs from "@/utils/dayjs";
import { Text } from "@/utils/validators/helpers/text";
import { zDayjs } from "@/utils/validators/helpers/custom";

const filterSchemaForm = z
  .object({
    searchText: Text.Handle(),
    startDate: zDayjs.nullable(),
    endDate: zDayjs.nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate.isBefore(v.startDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be after start date",
      });
    }
  });

const filterApiInputSchema = z.object({
  ...filterSchemaForm.shape,
  startDate: z.iso.datetime().nullable(),
  endDate: z.iso.datetime().nullable(),
});

const filterCodec = z.codec(filterApiInputSchema, filterSchemaForm, {
  decode: (v) => ({
    ...v,
    startDate: v.startDate ? dayjs(v.startDate) : null,
    endDate: v.endDate ? dayjs(v.endDate) : null,
  }),
  encode: (v) => ({
    ...v,
    startDate: v.startDate?.toISOString() || null,
    endDate: v.endDate?.toISOString() || null,
  }),
});

type FilterValues = z.infer<typeof filterSchemaForm>;
type FilterFormInput = z.input<typeof filterSchemaForm>;
type FilterApi = z.input<typeof filterCodec>; // strings (API payload)
type FilterDomain = z.output<typeof filterCodec>; // Dayjs objects to run operations on
