import { pgTable, uuid, uniqueIndex, bigint, index } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { message_reaction_groups } from "./message_reaction_groups";

export const message_reactions = pgTable(
  "message_reactions",

  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    group_id: bigint("group_id", { mode: "number" })
      .notNull()
      .references(() => message_reaction_groups.id),
    user_id: uuid()
      .notNull()
      .references(() => user.id),
  },
  (table) => [
    uniqueIndex("message_reactions_unique").on(table.group_id, table.user_id),
    index("message_reactions_group_id_index").on(table.group_id, table.id),
    index("message_reactions_user_index").on(table.user_id),
  ]
);
