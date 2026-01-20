// small branded type just to get a readable label
type _<L> = number & {
  __brand: L;
};

const storageBuilder = <UnitName extends string>(unit: number) => {
  const fn = <N extends number>(size: N, isKibibytes?: boolean) =>
    ((size * unit) / (isKibibytes ? 1024 : 1)) as _<`${N} ${UnitName}`>;

  return fn;
};

export const bytes = storageBuilder<"B">(1);
export const kibibytes = storageBuilder<"KiB">(1024);
export const mebibytes = storageBuilder<"MiB">(1024 ** 2);
export const gibibytes = storageBuilder<"GiB">(1024 ** 3);

export const kilobytes = storageBuilder<"KB">(1000);
export const megabytes = storageBuilder<"MB">(1000 ** 2);
export const gigabytes = storageBuilder<"GB">(1000 ** 3);
