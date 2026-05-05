export const runConcurrently = async <T>(
  items: T[],
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

export const runChunksConcurrently = async <T>(
  items: T[],
  chunkSize: number,
  concurrency: number,
  worker: (chunk: T[]) => Promise<void>
): Promise<void> => {
  const safeChunkSize = Math.max(1, chunkSize);
  const safeConcurrency = Math.max(1, concurrency);

  const chunks: T[][] = Array.from(
    { length: Math.ceil(items.length / safeChunkSize) },
    (_, i) => items.slice(i * safeChunkSize, (i + 1) * safeChunkSize)
  );

  let counter = 0;

  const runners = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const i = counter;
      counter++;

      const chunk = chunks[i];

      if (!chunk) return;

      await worker(chunk);
    }
  });

  await Promise.all(runners);
};
