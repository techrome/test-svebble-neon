import {
  bigint,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { isNotNull, isNull } from "drizzle-orm";

import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";
import { user } from "./auth";
import { channels } from "./channels";

export const messages = pgTable(
  "messages",
  withDefaultColumns(
    {
      id: bigint("id", { mode: "bigint" })
        .primaryKey()
        .generatedAlwaysAsIdentity(),
      user_id: uuid()
        .notNull()
        .references(() => user.id),
      content: varchar({ length: TEXT_LIMITS.long }).notNull(),
      channel_id: bigint("channel_id", { mode: "bigint" })
        .notNull()
        .references(() => channels.id),
      deleted_at: timestamp({ withTimezone: true, precision: 3 }),
    },
    { id: false }
  ),
  (table) => [
    index("messages_active_messages_by_user_index")
      .on(table.user_id, table.id)
      .where(isNull(table.deleted_at)),
    index("messages_active_messages_index")
      .on(table.channel_id, table.id)
      .where(isNull(table.deleted_at)),
    index("messages_cleanup_index")
      .on(table.deleted_at, table.id)
      .where(isNotNull(table.deleted_at)),
  ]
);
