import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";
import { user } from "./auth";
import { sql } from "drizzle-orm";
import {
  FILE_PURPOSE,
  FILE_PURPOSES_ENUM,
  FILE_STATUS,
  FILE_STATUSES_ENUM,
  literal,
} from "../helpers/enums";

export const fileStatusEnum = pgEnum("file_status", FILE_STATUSES_ENUM);
export const filePurposeEnum = pgEnum("file_purpose", FILE_PURPOSES_ENUM);

export const filesSchema = pgTable(
  "files",
  withDefaultColumns({
    owner_user_id: uuid()
      .notNull()
      .references(() => user.id),
    status: fileStatusEnum("status").notNull(),
    purpose: filePurposeEnum("purpose").notNull(),
    object_key: varchar({ length: TEXT_LIMITS.long }).notNull().unique(),
    deleted_at: timestamp({ withTimezone: true, precision: 3 }),
    error_text: varchar({ length: TEXT_LIMITS.long }),
  }),
  (table) => [
    index("cleanup_index")
      .on(table.created_at)
      .where(
        sql`${table.status} in ${[FILE_STATUS.issued, FILE_STATUS.inactive, FILE_STATUS.deleted, FILE_STATUS.error].map((v) => literal(v))}`
      ),
    index("user_purpose_index").on(
      table.owner_user_id,
      table.purpose,
      table.status
    ),
    uniqueIndex("active_avatar_unique_index")
      .on(table.owner_user_id)
      .where(
        sql`${table.purpose} = ${literal(FILE_PURPOSE.avatar)} AND ${table.status} = ${literal(FILE_STATUS.active)}`
      ),
  ]
);
