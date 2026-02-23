// small branded type just to get a readable label of the duration time
type _<L> = number & {
  __brand: L;
};

const timeBuilder = <UnitName extends string>(unit: number) => {
  const timeFn = <N extends number>(duration: N, isSeconds?: boolean) =>
    ((duration * unit) / (isSeconds ? 1_000 : 1)) as _<`${N} ${UnitName}`>;

  return timeFn;
};

export const seconds = timeBuilder<"seconds">(1_000);
export const minutes = timeBuilder<"minutes">(60_000);
export const hours = timeBuilder<"hours">(3_600_000);
export const days = timeBuilder<"days">(86_400_000);

export const CACHE_TIME_MS = {
  REALTIME: seconds(0),
  QUICKEST: seconds(15),
  QUICKER: seconds(30),
  QUICK: minutes(1),
  NORMAL: minutes(5),
  LONG: minutes(30),
  STATIC: days(1),
} as const;

const msToSeconds = <const T extends Record<string, number>>(msObj: T) =>
  Object.fromEntries(Object.entries(msObj).map(([k, v]) => [k, v / 1_000])) as {
    readonly [K in keyof T]: T[K];
  };

export const CACHE_TIME_S = msToSeconds(CACHE_TIME_MS);
