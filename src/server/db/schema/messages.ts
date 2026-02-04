import { bigint, index, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

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
    },
    { id: false }
  ),
  (table) => [index("messages_id_index").on(table.id)]
);
