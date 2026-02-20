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
      //channel_id:
      deleted_at: timestamp({ withTimezone: true, precision: 3 }),
    },
    { id: false }
  )
);
