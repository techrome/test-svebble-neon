export function* chunked<T>(
  arr: readonly T[],
  chunkSize: number
): Generator<T[]> {
  for (let i = 0; i < arr.length; i += chunkSize) {
    yield arr.slice(i, i + chunkSize);
  }
}
