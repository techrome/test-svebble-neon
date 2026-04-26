import {
  bigint,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";
import { user } from "./auth";
import { isNotNull, isNull, sql } from "drizzle-orm";

export const channels = pgTable(
  "channels",
  withDefaultColumns(
    {
      id: bigint("id", { mode: "bigint" })
        .primaryKey()
        .generatedAlwaysAsIdentity(),
      user_id: uuid()
        .notNull()
        .references(() => user.id),
      name: varchar({ length: TEXT_LIMITS.title }).notNull(),
      messages_version: bigint("messages_version", {
        mode: "bigint",
      })
        .notNull()
        .default(sql`1`),
      deleted_at: timestamp({ withTimezone: true, precision: 3 }),
    },
    { id: false }
  ),
  (table) => [
    index("channels_active_index").on(table.id).where(isNull(table.deleted_at)),
    index("channels_cleanup_index")
      .on(table.deleted_at, table.id)
      .where(isNotNull(table.deleted_at)),
  ]
);
