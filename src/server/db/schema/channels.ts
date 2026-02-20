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
      deleted_at: timestamp({ withTimezone: true, precision: 3 }),
      messages_updated_at: timestamp({ withTimezone: true, precision: 3 })
        .notNull()
        .defaultNow(),
    },
    { id: false }
  ),
  (table) => [index("channels_user_id_index").on(table.user_id)]
);
