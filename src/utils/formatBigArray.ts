export const formatBigArray = <T>(
  arr: T[] | undefined,
  itemsPerSide: number = 2
): (T | string)[] | typeof arr => {
  if (!arr) return arr;

  const size = arr.length;
  if (size <= itemsPerSide * 2) {
    return arr;
  }

  return [
    ...arr.slice(0, itemsPerSide),
    `... ${size} items in total ...`,
    ...arr.slice(-itemsPerSide),
  ];
};
