// small branded type just to get a readable label
type _<L> = number & {
  __brand: L;
};

const KB = 1024;
const MB = 1024 ** 2;
const GB = 1024 ** 3;

const storageUnit =
  <UnitName extends string>(unit: number) =>
  <N extends number>(size: N) =>
    (size * unit) as _<`${N} ${UnitName}`>;

// these are technically kibi/mebi-bytes, but most systems use naming convention of kilo/mega anyway
export const bytes = storageUnit<"B">(1);
export const kilobytes = storageUnit<"KB">(KB);
export const megabytes = storageUnit<"MB">(MB);
export const gigabytes = storageUnit<"GB">(GB);

/////////////////////////

const UNITS = [
  { unit: "GB", size: GB },
  { unit: "MB", size: MB },
  { unit: "KB", size: KB },
] as const;

const truncateToTwoDecimals = (value: number) => {
  return Math.floor(value * 100) / 100;
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const matchedUnit = UNITS.find(({ size }) => bytes >= size) || {
    unit: "B",
    size: 1,
  };

  const value = truncateToTwoDecimals(bytes / matchedUnit.size);

  return `${matchedUnit.unit === "B" ? value : value.toFixed(2)} ${matchedUnit.unit}`;
};
