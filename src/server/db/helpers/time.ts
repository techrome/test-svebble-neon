import { sql } from "drizzle-orm";

// aliases for time comparisons only
export {
  lt as before,
  gt as after,
  gte as afterOrEqual,
  lte as beforeOrEqual,
} from "drizzle-orm";

export const nowMinus = (milliseconds: number) =>
  sql`now() - (${milliseconds}::bigint * interval '1 millisecond')`;
