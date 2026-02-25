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
import { sql } from "drizzle-orm";

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
        .default(sql`0`),
      deleted_at: timestamp({ withTimezone: true, precision: 3 }),
    },
    { id: false }
  ),
  (table) => [
    index("channels_active_user_id_index")
      .on(table.user_id)
      .where(sql`${table.deleted_at} IS NULL`),
  ]
);
