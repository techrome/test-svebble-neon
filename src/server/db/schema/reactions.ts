import {
  pgTable,
  uuid,
  varchar,
  uniqueIndex,
  text,
  check,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { and, isNotNull, isNull, or, sql } from "drizzle-orm";

import { withDefaultColumns } from "../helpers/withDefaultColumns";
import { literal, REACTION_KIND, REACTIONS_KINDS_ENUM } from "../helpers/enums";
import { files } from "./files";

export const reactions = pgTable(
  "reactions",
  withDefaultColumns(
    {
      id: integer().primaryKey().generatedAlwaysAsIdentity(),
      kind: text("kind", { enum: REACTIONS_KINDS_ENUM }).notNull(),
      slug: varchar({ length: 64 }).notNull().unique(),
      emoji: varchar({ length: 64 }),
      file_id: uuid().references(() => files.id),
      sort_order: integer().notNull(),
      disabled_at: timestamp({ withTimezone: true, precision: 3 }),
    },
    { id: false }
  ),
  (table) => [
    uniqueIndex("reactions_unicode_unique")
      .on(table.emoji)
      .where(sql`${table.kind} = ${literal(REACTION_KIND.unicode)}`),
    uniqueIndex("reactions_file_unique")
      .on(table.file_id)
      .where(sql`${table.kind} = ${literal(REACTION_KIND.custom)}`),
    check(
      "reactions_value_check",
      or(
        and(
          sql`${table.kind} = ${literal(REACTION_KIND.unicode)}`,
          isNotNull(table.emoji),
          isNull(table.file_id)
        ),
        and(
          sql`${table.kind} = ${literal(REACTION_KIND.custom)}`,
          isNotNull(table.file_id),
          isNull(table.emoji)
        )
      )!
    ),
    check(
      "reactions_sort_order_non_negative_check",
      sql`${table.sort_order} >= 0`
    ),
    check(
      "reactions_kind_check",
      sql`${table.kind} in ${REACTIONS_KINDS_ENUM.map(literal)}`
    ),
  ]
);
