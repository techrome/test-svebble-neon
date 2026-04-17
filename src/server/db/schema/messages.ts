import {
  bigint,
  index,
  integer,
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
      content: varchar({ length: TEXT_LIMITS.long * 4 }).notNull(),
      channel_id: bigint("channel_id", { mode: "bigint" })
        .notNull()
        .references(() => channels.id),
      reply_to_message_id: bigint("reply_to_message_id", { mode: "bigint" }),
      reply_count: integer("reply_count").notNull().default(0),
      deleted_at: timestamp({ withTimezone: true, precision: 3 }),
    },
    { id: false }
  ),
  (table) => [
    index("messages_active_messages_by_user_index")
      .on(table.user_id, table.id)
      .where(isNull(table.deleted_at)),
    index("messages_active_messages_and_replies_index")
      .on(table.channel_id, table.id, table.reply_to_message_id)
      .where(isNull(table.deleted_at)),
    index("messages_cleanup_index")
      .on(table.deleted_at, table.id)
      .where(isNotNull(table.deleted_at)),
  ]
);
