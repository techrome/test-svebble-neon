import {
  pgTable,
  uuid,
  index,
  uniqueIndex,
  bigint,
  integer,
} from "drizzle-orm/pg-core";

import { messages } from "./messages";
import { reactions } from "./reactions";
import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { user } from "./auth";

export const message_reactions = pgTable(
  "message_reactions",
  withDefaultColumns(
    {
      reaction_id: integer()
        .notNull()
        .references(() => reactions.id),
      message_id: bigint("message_id", { mode: "number" })
        .notNull()
        .references(() => messages.id),
      user_id: uuid()
        .notNull()
        .references(() => user.id),
    },
    { id: false, updated_at: false }
  ),
  (table) => [
    uniqueIndex("message_reactions_unique").on(
      table.message_id,
      table.reaction_id,
      table.user_id
    ),
    index("message_reactions_user_message_index").on(
      table.user_id,
      table.message_id
    ),
    index("message_reactions_reaction_index").on(table.reaction_id),
  ]
);
