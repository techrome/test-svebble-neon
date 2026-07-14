import { pgTable, uniqueIndex, bigint, integer } from "drizzle-orm/pg-core";

import { messages } from "./messages";
import { reactions } from "./reactions";
import { withDefaultColumns } from "../helpers/withDefaultColumns";

export const message_reaction_groups = pgTable(
  "message_reaction_groups",
  withDefaultColumns(
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
    },
    { id: false, updated_at: false }
  ),
  (table) => [
    uniqueIndex("message_reaction_groups_unique").on(
      table.message_id,
      table.reaction_id
    ),
  ]
);
