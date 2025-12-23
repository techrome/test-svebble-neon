import { sql } from "drizzle-orm";
import { uuid, timestamp } from "drizzle-orm/pg-core";

const idColumn = () => uuid().primaryKey().defaultRandom();
const createdAtColumn = () =>
  timestamp({ withTimezone: true, precision: 3 }).notNull().defaultNow();
const updatedAtColumn = () =>
  timestamp({ withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`);

const defaultColumns = {
  id: {
    default: true,
    getColumn: () => idColumn(),
  },
  created_at: {
    default: true,
    getColumn: () => createdAtColumn(),
  },
  updated_at: {
    default: true,
    getColumn: () => updatedAtColumn(),
  },
} as const satisfies Record<
  string,
  { default: boolean; getColumn: () => unknown }
>;

// All this TS boilerplate just to force the function to correctly infer the returned types

type DefaultColumns = typeof defaultColumns;
type DefaultColumnKeys = keyof DefaultColumns;

type Options = Partial<Record<DefaultColumnKeys, boolean>>;

type OptionBoolOrDefault<O extends Options, K extends keyof Options> = [
  O[K],
] extends [boolean]
  ? O[K]
  : DefaultColumns[K]["default"];

type GetDefaultColumn<K extends DefaultColumnKeys> = ReturnType<
  DefaultColumns[K]["getColumn"]
>;

type DefaultsFor<O extends Options> = {
  [K in DefaultColumnKeys as OptionBoolOrDefault<O, K> extends true
    ? K
    : never]: GetDefaultColumn<K>;
};

export const withDefaultColumns = <T extends object, O extends Options>(
  initial: T,
  options: O = {} as O
) => {
  let defaults: Record<string, unknown> = {};
  for (const columnName of Object.keys(defaultColumns) as DefaultColumnKeys[]) {
    const shouldIncludeColumn =
      options[columnName] ?? defaultColumns[columnName].default;
    if (shouldIncludeColumn) {
      defaults[columnName] = defaultColumns[columnName].getColumn();
    }
  }

  return { ...defaults, ...initial } as Omit<DefaultsFor<O>, keyof T> & T;
};
