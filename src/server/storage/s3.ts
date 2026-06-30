import { env } from "../env";
import { S3Client } from "@aws-sdk/client-s3";

const makeS3Client = () => {
  if (
    !env.BACKBLAZE_REGION ||
    !env.BACKBLAZE_ENDPOINT ||
    !env.BACKBLAZE_APP_KEY_ID ||
    !env.BACKBLAZE_APP_KEY
  ) {
    throw new Error("Backblaze variables required for creating S3 client");
  }
  return new S3Client({
    region: env.BACKBLAZE_REGION,
    endpoint: env.BACKBLAZE_ENDPOINT,
    credentials: {
      accessKeyId: env.BACKBLAZE_APP_KEY_ID,
      secretAccessKey: env.BACKBLAZE_APP_KEY,
    },
    forcePathStyle: true,
  });
};

export const s3Client = makeS3Client();
