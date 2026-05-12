import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
  text,
  check,
  bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { FILE_LIMITS, TEXT_LIMITS } from "@/utils/validators/helpers/text";
import { user } from "./auth";
import {
  FILE_PURPOSE,
  FILE_PURPOSES_ENUM,
  FILE_STATUS,
  FILE_STATUSES_ENUM,
  literal,
} from "../helpers/enums";

export const files = pgTable(
  "files",
  withDefaultColumns({
    owner_user_id: uuid()
      .notNull()
      .references(() => user.id),
    status: text("status", { enum: FILE_STATUSES_ENUM }).notNull(),
    purpose: text("purpose", { enum: FILE_PURPOSES_ENUM }).notNull(),
    object_key: varchar({ length: TEXT_LIMITS.long }).notNull().unique(),
    original_name: varchar({ length: FILE_LIMITS.name }),
    extension: varchar({ length: FILE_LIMITS.extension }),
    size_bytes: bigint("size_bytes", { mode: "number" }),
    deleted_at: timestamp({ withTimezone: true, precision: 3 }),
    error_text: varchar({ length: TEXT_LIMITS.long }),
    info_text: varchar({ length: TEXT_LIMITS.long }),
  }),
  (table) => [
    index("files_cleanup_index")
      .on(table.created_at)
      .where(
        sql`${table.status} in ${[FILE_STATUS.issued, FILE_STATUS.inactive, FILE_STATUS.deleted, FILE_STATUS.error].map(literal)}`
      ),
    index("files_user_purpose_index").on(
      table.owner_user_id,
      table.purpose,
      table.status
    ),
    uniqueIndex("files_active_avatar_unique_index")
      .on(table.owner_user_id)
      .where(
        sql`${table.purpose} = ${literal(FILE_PURPOSE.avatar)} AND ${table.status} = ${literal(FILE_STATUS.active)}`
      ),
    check(
      "files_status_check",
      sql`${table.status} in ${FILE_STATUSES_ENUM.map(literal)}`
    ),
    check(
      "files_purpose_check",
      sql`${table.purpose} in ${FILE_PURPOSES_ENUM.map(literal)}`
    ),
    check("files_size_bytes_non_negative_check", sql`${table.size_bytes} >= 0`),
  ]
);
