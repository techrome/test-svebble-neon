import { pgTable, varchar } from "drizzle-orm/pg-core";

import { withDefaultColumns } from "@/db/helpers/withDefaultColumns";

export const commentsSchema = pgTable(
  "comments",
  withDefaultColumns({
    text: varchar({ length: 255 }).notNull(),
  })
);
