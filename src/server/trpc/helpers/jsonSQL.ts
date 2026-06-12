import { sql, type AnyColumn, type SQL } from "drizzle-orm";

type JsonField = AnyColumn | SQL;

export function jsonBuildObject(shape: Record<string, JsonField>) {
  const chunks = Object.entries(shape).flatMap(([key, value]) => [
    sql`${key}::text`,
    sql`${value}`,
  ]);

  return sql`jsonb_build_object(${sql.join(chunks, sql`, `)})`;
}

export function jsonAggBuildObject<T>(
  shape: Record<string, JsonField>,
  opts: {
    filterWhere?: SQL;
    orderBy?: JsonField;
  }
) {
  return sql<T>`
    coalesce(
      jsonb_agg(
        ${jsonBuildObject(shape)}
        ${opts.orderBy ? sql` order by ${opts.orderBy}` : sql``}
      )
      ${opts.filterWhere ? sql` filter (where ${opts.filterWhere})` : sql``},
      '[]'::jsonb
    )
  `;
}
