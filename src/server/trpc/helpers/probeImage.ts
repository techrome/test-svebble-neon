import sizeOf from "image-size";

import { kibibytes } from "@/utils/storageUnits";

const MAX_BYTES = kibibytes(64);

// a performant way to get remote image's dimensions without having to download the whole image
export const probeImageDimensions = async (s3Url: string) => {
  const res = await fetch(s3Url, {
    headers: { Range: `bytes=0-${MAX_BYTES - 1}` },
  });

  if (!res.ok || !res.body) throw new Error(`Fetch failed: ${res.status}`);

  const reader = res.body.getReader();
  const buf = Buffer.allocUnsafe(MAX_BYTES);
  let bytesFetched = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    if (bytesFetched + value.byteLength > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`Exceeded ${MAX_BYTES} bytes without dimensions`);
    }

    buf.set(value, bytesFetched);
    bytesFetched += value.byteLength;

    try {
      const imageInfo = sizeOf(buf.subarray(0, bytesFetched));
      await reader.cancel();
      return {
        width: imageInfo.width,
        height: imageInfo.height,
        type: imageInfo.type,
        bytesFetched,
      };
    } catch {}
  }

  throw new Error("Stream ended before dimensions could be determined");
};
