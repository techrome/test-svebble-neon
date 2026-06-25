import { Buffer } from "node:buffer";
import { fileTypeFromBuffer } from "file-type";

import { kilobytes } from "@/utils/storageUnits";
import { seconds } from "@/utils/cacheTime";

const MAX_BYTES = kilobytes(16);

// a performant way to get remote file type without having to download the whole file
export const probeFileType = async (s3Url: string) => {
  const res = await fetch(s3Url, {
    headers: { Range: `bytes=0-${MAX_BYTES - 1}` },
    signal: AbortSignal.timeout(seconds(10)),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Fetch failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const buf = Buffer.allocUnsafe(MAX_BYTES);

  let bytesFetched = 0;
  let detectedFileType:
    | Awaited<ReturnType<typeof fileTypeFromBuffer>>
    | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;

    if (bytesFetched + value.byteLength > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`Exceeded ${MAX_BYTES} bytes without type`);
    }

    buf.set(value, bytesFetched);
    bytesFetched += value.byteLength;

    const currentBytes = buf.subarray(0, bytesFetched);
    if (!detectedFileType) {
      detectedFileType = await fileTypeFromBuffer(currentBytes);
    }

    if (detectedFileType) {
      await reader.cancel();
      return {
        detectedFileType,
        bytesFetched,
        kind: "binary",
      } as const;
    }
  }

  return {
    detectedFileType: undefined,
    bytesFetched,
    kind: "text",
  } as const;
};
