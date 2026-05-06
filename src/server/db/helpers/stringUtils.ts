import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export const leftText = (value: SQLWrapper, length: number): SQL<string> =>
  sql<string>`left(${value}, ${length})`;
