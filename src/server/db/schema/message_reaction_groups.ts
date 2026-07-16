import {
  pgTable,
  uniqueIndex,
  bigint,
  integer,
  check,
  index,
} from "drizzle-orm/pg-core";

import { messages } from "./messages";
import { reactions } from "./reactions";
import { sql } from "drizzle-orm";

export const message_reaction_groups = pgTable(
  "message_reaction_groups",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    message_id: bigint("message_id", { mode: "number" })
      .notNull()
      .references(() => messages.id),
    reaction_id: integer()
      .notNull()
      .references(() => reactions.id),
    reaction_count: integer().notNull().default(0),
  },
  (table) => [
    uniqueIndex("message_reaction_groups_unique").on(
      table.message_id,
      table.reaction_id
    ),
    index("message_reaction_groups_reaction_index").on(table.reaction_id),
    check(
      "message_reaction_groups_reaction_count_non_negative_check",
      sql`${table.reaction_count} >= 0`
    ),
  ]
);
