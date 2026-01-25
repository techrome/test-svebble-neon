export const runConcurrently = async <T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  let counter = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = counter;
      counter++;
      if (i >= items.length) return;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
};
