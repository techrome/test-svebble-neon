import {
  pgTable,
  uuid,
  varchar,
  pgEnum,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { TEXT_LIMITS } from "@/utils/validators/helpers/text";
import { user } from "./auth";
import { sql } from "drizzle-orm";

export const FILE_STATUS = {
  issued: "issued",
  claimed: "claimed",
  active: "active",
  inactive: "inactive",
  rejected: "rejected",
  deleted: "deleted",
  error: "error",
} as const;
export const FILE_PURPOSE = {
  avatar: "avatar",
  message_attachment: "message_attachment",
} as const;

export const FILE_STATUSES_ENUM = [
  FILE_STATUS.issued,
  FILE_STATUS.claimed,
  FILE_STATUS.active,
  FILE_STATUS.inactive,
  FILE_STATUS.rejected,
  FILE_STATUS.deleted,
  FILE_STATUS.error,
] as const;
export const FILE_PURPOSES_ENUM = [
  FILE_PURPOSE.avatar,
  FILE_PURPOSE.message_attachment,
] as const;

export const fileStatusEnum = pgEnum("file_status", FILE_STATUSES_ENUM);
export const filePurposeEnum = pgEnum("file_purpose", FILE_PURPOSES_ENUM);

const literal = (s: string) => sql.raw(`'${s.replace(/'/g, "''")}'`);

export const filesSchema = pgTable(
  "files",
  withDefaultColumns({
    owner_user_id: uuid()
      .notNull()
      .references(() => user.id),
    status: fileStatusEnum("status"),
    purpose: filePurposeEnum("purpose"),
    object_key: varchar({ length: TEXT_LIMITS.long }).notNull().unique(),
    deleted_at: timestamp({ withTimezone: true, precision: 3 }),
  }),
  (table) => [
    index("cleanup_index").on(table.status, table.created_at),
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
