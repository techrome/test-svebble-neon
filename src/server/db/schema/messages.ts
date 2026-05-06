import {
  bigint,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { and, isNotNull, isNull } from "drizzle-orm";

import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { user } from "./auth";
import { channels } from "./channels";
import { messageContentHtmlMaxLength } from "../../trpc/validators/messages";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";

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
      content: varchar({ length: messageContentHtmlMaxLength }).notNull(),
      content_text: varchar({ length: TEXT_LIMITS.long }).notNull(),
      channel_id: bigint("channel_id", { mode: "bigint" })
        .notNull()
        .references(() => channels.id),
      reply_to_message_id: bigint("reply_to_message_id", { mode: "bigint" }),
      reply_count: integer("reply_count").notNull().default(0),
      deleted_at: timestamp({ withTimezone: true, precision: 3 }),
      edited_at: timestamp({ withTimezone: true, precision: 3 })
        .notNull()
        .defaultNow(),
    },
    { id: false, updated_at: false }
  ),
  (table) => [
    index("messages_active_messages_by_user_index")
      .on(table.user_id, table.id)
      .where(isNull(table.deleted_at)),
    index("messages_active_messages_index")
      .on(table.channel_id, table.id)
      .where(isNull(table.deleted_at)),
    index("messages_active_replies_by_parent_index")
      .on(table.reply_to_message_id, table.id)
      .where(
        and(isNull(table.deleted_at), isNotNull(table.reply_to_message_id))!
      ),
    // index("messages_active_content_text_trgm_index")
    //   .using("gin", table.content_text.op("gin_trgm_ops"))
    //   .where(isNull(table.deleted_at)),
    index("messages_cleanup_index")
      .on(table.deleted_at, table.id)
      .where(isNotNull(table.deleted_at)),
  ]
);
