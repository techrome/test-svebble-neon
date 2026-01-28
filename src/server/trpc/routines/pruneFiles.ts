import { and, asc, eq, inArray } from "drizzle-orm";
import humanizeDuration from "humanize-duration";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

import { db } from "../../db";
import { files } from "../../db/schema/files";
import { FileStatus } from "../../db/helpers/enums";
import { before, nowMinus } from "../../db/helpers/time";
import { s3Client } from "../../storage";
import { env } from "../../env";
import { formatBigArray } from "../../../utils/formatBigArray";

type PruneResult = {
  dbFilesToDeleteCount: number;
  s3DeletedKeysCount: number;
  dbDeletedRowsCount: number;
  pruneCountsMatch: boolean;
  hasMoreData: boolean;
  errors: Array<{ objectKey: string; code?: string; message?: string }>;
};

export const pruneFiles = async ({
  statusesToDelete,
  howOldMs = 0,
  userId,
}: {
  statusesToDelete?: FileStatus[];
  howOldMs?: number;
  userId?: string;
} = {}): Promise<PruneResult> => {
  console.log(
    `[pruneFiles] Started. Pruning files older than ${humanizeDuration(howOldMs)} with statuses: ${statusesToDelete ? statusesToDelete.join(", ") : "All statuses"}. User ID: ${userId || "no user ID"}`
  );

  const limit = 1000; // don't send more than 1000 in a single request to S3
  const buildBaseQuery = () =>
    db
      .select({
        id: files.id,
        object_key: files.object_key,
      })
      .from(files)
      .where(
        and(
          before(files.created_at, nowMinus(howOldMs)),

          statusesToDelete?.length
            ? inArray(files.status, statusesToDelete)
            : undefined,

          userId ? eq(files.owner_user_id, userId) : undefined
        )
      )
      .orderBy(asc(files.created_at));

  const filesToDelete = await buildBaseQuery().limit(limit);

  if (!filesToDelete.length) {
    console.log("[pruneFiles] No files to prune. Aborting");
    return {
      dbFilesToDeleteCount: 0,
      s3DeletedKeysCount: 0,
      dbDeletedRowsCount: 0,
      pruneCountsMatch: true,
      hasMoreData: false,
      errors: [],
    };
  } else {
    console.log(
      `[pruneFiles] ${filesToDelete.length} files to prune:`,
      formatBigArray(filesToDelete)
    );
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
    deleted: formatBigArray(s3DeletionResult.Deleted),
    errors: formatBigArray(s3DeletionResult.Errors),
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
    console.log("[pruneFiles] Files pruned from DB:", formatBigArray(res));
    dbDeletedRowsCount = res.length;
  }

  const pruneCountsMatch =
    new Set([filesToDelete.length, keysToDelete.length, dbDeletedRowsCount])
      .size === 1;

  const hasMoreData = pruneCountsMatch
    ? (await buildBaseQuery().limit(1)).length > 0
    : true;

  return {
    dbFilesToDeleteCount: filesToDelete.length,
    s3DeletedKeysCount: keysToDelete.length,
    dbDeletedRowsCount,
    pruneCountsMatch,
    hasMoreData,
    errors,
  };
};
