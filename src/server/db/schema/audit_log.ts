import {
  pgTable,
  uuid,
  varchar,
  index,
  text,
  jsonb,
  check,
} from "drizzle-orm/pg-core";

import { withDefaultColumns } from "../helpers/withDefaultColumns";

import { sql } from "drizzle-orm";
import { AUDIT_LOG_ACTION_ENUM, literal } from "../helpers/enums";

export const audit_log = pgTable(
  "audit_log",
  withDefaultColumns({
    action: text("action", { enum: AUDIT_LOG_ACTION_ENUM }).notNull(),
    actor_user_id: uuid(), // nullable
    ip_address: varchar({ length: 4096 }),
    user_agent: varchar({ length: 512 }),
    session_id: varchar({ length: 128 }),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  }),
  (table) => [
    index("audit_created_at_index").on(table.created_at),
    index("audit_actor_created_at_index").on(
      table.actor_user_id,
      table.created_at
    ),
    index("audit_action_created_at_index").on(table.action, table.created_at),
    check(
      "audit_action_check",
      sql`${table.action} in ${AUDIT_LOG_ACTION_ENUM.map(literal)}`
    ),
  ]
);
