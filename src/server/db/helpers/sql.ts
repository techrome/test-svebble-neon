import {
  sql,
  type SQL,
  type SQLWrapper,
  type AnyColumn,
  type GetColumnData,
  exists,
} from "drizzle-orm";

export const firstNonNull = <T>(
  first: SQLWrapper,
  second: SQLWrapper,
  ...args: SQLWrapper[]
): SQL<T> => {
  const chunks = [first, second, ...args].map((value) => sql`${value}`);

  return sql<T>`coalesce(${sql.join(chunks, sql`, `)})`;
};

export const sqlAny = (command: SQLWrapper) => sql`ANY(${command.getSQL()})`;
export const sqlArray = (command: SQLWrapper) =>
  sql`ARRAY(${command.getSQL()})`;
export const sqlNow = () => sql`now()`;

type ScalarSelectData<TColumn extends AnyColumn | SQL.Aliased<unknown>> =
  TColumn extends AnyColumn
    ? GetColumnData<TColumn>
    : TColumn extends SQL.Aliased<infer TData>
      ? TData
      : never;

export const scalarSelect = <TColumn extends AnyColumn | SQL.Aliased<unknown>>(
  column: TColumn,
  from: SQLWrapper
): SQL<ScalarSelectData<TColumn>> => {
  return sql<ScalarSelectData<TColumn>>`(select ${column} from ${from})`;
};

type AliasedColumns<T extends Record<string, AnyColumn>> = {
  [K in keyof T]: SQL.Aliased<GetColumnData<T[K]>>;
};

export const aliasColumns = <T extends Record<string, AnyColumn>>(
  columns: T
): AliasedColumns<T> => {
  return Object.fromEntries(
    Object.entries(columns).map(([alias, column]) => [
      alias,
      sql`${column}`.mapWith(column).as(alias),
    ])
  ) as AliasedColumns<T>;
};

export const existsFrom = (from: SQLWrapper) =>
  exists(sql`(select 1 from ${from})`);
