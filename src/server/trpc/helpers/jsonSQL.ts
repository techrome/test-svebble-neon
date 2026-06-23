import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { firstNonNull } from "../../db/helpers/sql";

export const jsonBuildObject = (shape: Record<string, SQLWrapper>) => {
  const chunks = Object.entries(shape).flatMap(([key, value]) => [
    sql`${key}::text`,
    sql`${value}`,
  ]);

  return sql`json_build_object(${sql.join(chunks, sql`, `)})`;
};

export const emptyJsonArray = () => sql`'[]'::json`;

export const jsonAggBuildArray = <T>(
  shape: Record<string, SQLWrapper>,
  opts: {
    filterWhere?: SQL;
    orderBy?: SQLWrapper;
    noFallbackArray?: boolean;
  } = {}
) => {
  const mainSql = sql<T>`json_agg(${jsonBuildObject(shape)}${opts.orderBy ? sql` order by ${opts.orderBy}` : sql``})${opts.filterWhere ? sql` filter (where ${opts.filterWhere})` : sql``}`;

  if (opts.noFallbackArray) return mainSql;
  else {
    return firstNonNull<T>(mainSql, emptyJsonArray());
  }
};
