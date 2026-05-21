import {
  pgTable,
  uuid,
  index,
  uniqueIndex,
  bigint,
  integer,
  check,
} from "drizzle-orm/pg-core";

import { messages } from "./messages";
import { files } from "./files";
import { sql } from "drizzle-orm";

export const message_attachments = pgTable(
  "message_attachments",
  {
    message_id: bigint("message_id", { mode: "number" })
      .notNull()
      .references(() => messages.id),
    file_id: uuid()
      .notNull()
      .references(() => files.id),
    sort_order: integer().notNull(),
  },
  (table) => [
    index("message_attachments_message_index").on(
      table.message_id,
      table.sort_order
    ),
    uniqueIndex("message_attachments_file_unique_index").on(table.file_id),
    check(
      "message_attachments_sort_order_non_negative_check",
      sql`${table.sort_order} >= 0`
    ),
  ]
);
