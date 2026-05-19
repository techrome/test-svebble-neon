import { Buffer } from "node:buffer";
import { fileTypeFromBuffer } from "file-type";
import sizeOf from "image-size";

import { kibibytes } from "@/utils/storageUnits";
import { seconds } from "@/utils/cacheTime";

const MAX_BYTES = kibibytes(64);

// a performant way to get remote image's dimensions and type without having to download the whole image
export const probeImageDimensionsAndType = async (s3Url: string) => {
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
      throw new Error(`Exceeded ${MAX_BYTES} bytes without dimensions/type`);
    }

    buf.set(value, bytesFetched);
    bytesFetched += value.byteLength;

    const currentBytes = buf.subarray(0, bytesFetched);
    if (!detectedFileType) {
      detectedFileType = await fileTypeFromBuffer(currentBytes);
    }

    try {
      const imageInfo = sizeOf(currentBytes);

      if (detectedFileType && imageInfo) {
        await reader.cancel();
        return {
          width: imageInfo.width,
          height: imageInfo.height,
          imageSizeType: imageInfo.type,
          detectedFileType,
          bytesFetched,
        };
      }
    } catch {}
  }

  throw new Error("Stream ended before dimensions/type could be determined");
};
