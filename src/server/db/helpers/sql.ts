import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

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
