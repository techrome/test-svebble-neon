import { pgTable, varchar } from "drizzle-orm/pg-core";

import { withDefaultColumns } from "./helpers/withDefaultColumns";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";

export const commentsSchema = pgTable(
  "comments",
  withDefaultColumns({
    text: varchar({ length: TEXT_LIMITS.short }).notNull(),
  })
);
