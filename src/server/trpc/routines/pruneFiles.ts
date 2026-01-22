import { and, asc, inArray } from "drizzle-orm";
import humanizeDuration from "humanize-duration";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

import { db } from "../../db";
import { files } from "../../db/schema/files";
import { FileStatus } from "../../db/helpers/enums";
import { before, nowMinus } from "../../db/helpers/time";
import { s3Client } from "../../storage";
import { env } from "../../env";

type PruneResult = {
  dbFilesToDeleteCount: number;
  s3DeletedKeysCount: number;
  dbDeletedRowsCount: number;
  errors: Array<{ objectKey: string; code?: string; message?: string }>;
};

export const pruneFiles = async ({
  statusesToDelete,
  howOldMs,
}: {
  statusesToDelete: FileStatus[];
  howOldMs: number;
}): Promise<PruneResult | undefined> => {
  console.log(
    `[pruneFiles] Started. Pruning files older than ${humanizeDuration(howOldMs)} with statuses: ${statusesToDelete.join(", ")}`
  );

  const limit = 1000; // don't send more than 1000 in a single request to S3

  const filesToDelete = await db
    .select({
      id: files.id,
      object_key: files.object_key,
    })
    .from(files)
    .where(
      and(
        inArray(files.status, statusesToDelete),
        before(files.created_at, nowMinus(howOldMs))
      )
    )
    .orderBy(asc(files.created_at))
    .limit(limit);

  if (!filesToDelete.length) {
    console.log("[pruneFiles] No files to prune. Aborting");
    return;
  } else {
    console.log("[pruneFiles] Files to prune:", filesToDelete);
  }
  const s3DeletionResult = await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: env.BACKBLAZE_BUCKET_NAME,
      Delete: {
        Quiet: false,
        Objects: filesToDelete.map((item) => ({ Key: item.object_key })),
      },
    })
  );

  console.log("[pruneFiles] S3 Bulk file deletion result:", {
    deleted: s3DeletionResult.Deleted,
    errors: s3DeletionResult.Errors,
    meta: s3DeletionResult.$metadata,
  });

  let errors: PruneResult["errors"] = [];
  let keysToDelete: string[] = [];

  for (const err of s3DeletionResult.Errors || []) {
    if (err.Key) {
      errors.push({
        objectKey: err.Key,
        code: err.Code,
        message: err.Message,
      });
    }
  }

  for (const del of s3DeletionResult.Deleted || []) {
    if (del.Key) keysToDelete.push(del.Key);
  }

  let dbDeletedRowsCount = 0;

  if (keysToDelete.length) {
    const res = await db
      .delete(files)
      .where(inArray(files.object_key, keysToDelete))
      .returning();
    console.log("[pruneFiles] Files pruned from DB:", res);
    dbDeletedRowsCount = res.length;
  }

  return {
    dbFilesToDeleteCount: filesToDelete.length,
    s3DeletedKeysCount: keysToDelete.length,
    dbDeletedRowsCount,
    errors,
  };
};
