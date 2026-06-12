// make some keys optional
export type PartialFor<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type IsPlainObject<T> = T extends object
  ? T extends unknown[] | ((...args: infer _A) => infer _R) | Date | RegExp
    ? false
    : true
  : false;

type StringKeys<T> = Extract<keyof T, string>;

export type GetObjectPaths<T> =
  IsPlainObject<T> extends true
    ? {
        [K in StringKeys<T>]: IsPlainObject<T[K]> extends true
          ? K | `${K}.${GetObjectPaths<T[K]>}`
          : K;
      }[StringKeys<T>]
    : never;

// type DecrementTable = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
// type Decrement<N extends number> = DecrementTable[N];

// export type GetObjectPathsWithLimitedDepth<T, Depth extends number = 6> = Depth extends 0
//   ? never
//   : IsPlainObject<T> extends true
//     ? {
//         [K in StringKeys<T>]: IsPlainObject<T[K]> extends true
//           ? K | `${K}.${GetObjectPathsWithLimitedDepth<T[K], Decrement<Depth>>}`
//           : K;
//       }[StringKeys<T>]
//     : never;

export type ToSerializable<T> = T extends bigint
  ? string
  : IsPlainObject<T> extends true
    ? { [K in keyof T]: ToSerializable<T[K]> }
    : T;

export type NullableFields<T> = { [K in keyof T]: T[K] | null };

export type StrictOmit<T, K extends keyof T> = Omit<T, K>;
