import { and, asc, eq, inArray } from "drizzle-orm";
import humanizeDuration from "humanize-duration";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

import { db, schema } from "../../db";
import { files } from "../../db/schema/files";
import { FILE_PURPOSE, FilePurpose, FileStatus } from "../../db/helpers/enums";
import { before, nowMinus } from "../../db/helpers/time";
import { s3Client } from "../../storage";
import { env } from "../../env";
import { formatBigArray } from "../../../utils/formatBigArray";

type PruneResult = {
  dbFilesToPruneCount: number;
  s3PrunedKeysCount: number;
  dbPrunedRowsCount: number;
  prunedFiles: {
    id: string;
    object_key: string;
    purpose: FilePurpose;
  }[];
  pruneCountsMatch: boolean;
  hasMoreData: boolean;
  errors: Array<{ objectKey: string; code?: string; message?: string }>;
};

const emptyResult = {
  dbFilesToPruneCount: 0,
  s3PrunedKeysCount: 0,
  dbPrunedRowsCount: 0,
  prunedFiles: [],
  pruneCountsMatch: true,
  hasMoreData: false,
  errors: [],
} satisfies PruneResult;

export const pruneFiles = async (
  props:
    | {
        criteria: "default";
        statusesToPrune: FileStatus[];
        howOldMs?: number;
        userId?: string;
      }
    | {
        criteria: "by id";
        idsToPrune: string[];
      }
): Promise<PruneResult> => {
  const isDefaultCriteria = props.criteria === "default";
  const limit = 1000; // don't send more than 1000 in a single request to S3
  if (isDefaultCriteria) {
    console.log(
      `[pruneFiles] Started. Pruning files older than ${humanizeDuration(props.howOldMs || 0)} with statuses: ${props.statusesToPrune ? props.statusesToPrune.join(", ") : "All statuses"}. User ID: ${props.userId || "no user ID"}`
    );
  } else {
    if (props.idsToPrune.length > limit) {
      throw new Error(`Cannot prune more than ${limit} files at once!`);
    }
    console.log(
      `[pruneFiles] Started. Pruning files by ID. ID count: ${props.idsToPrune.length}`
    );
  }

  if (!isDefaultCriteria && !props.idsToPrune.length) {
    return emptyResult;
  }

  const buildBaseQuery = () =>
    db
      .select({
        id: files.id,
        object_key: files.object_key,
        purpose: files.purpose,
      })
      .from(files)
      .where(
        isDefaultCriteria
          ? and(
              before(files.created_at, nowMinus(props.howOldMs || 0)),

              props.statusesToPrune?.length
                ? inArray(files.status, props.statusesToPrune)
                : undefined,

              props.userId ? eq(files.owner_user_id, props.userId) : undefined
            )
          : inArray(files.id, props.idsToPrune)
      )
      .orderBy(asc(files.created_at));

  const filesToPruneScan = await buildBaseQuery().limit(limit);

  if (!filesToPruneScan.length) {
    console.log("[pruneFiles] No files to prune. Aborting");
    return emptyResult;
  } else {
    console.log(
      `[pruneFiles] ${filesToPruneScan.length} files to prune:`,
      formatBigArray(filesToPruneScan)
    );
  }

  const s3PruneResult = await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: env.BACKBLAZE_BUCKET_NAME,
      Delete: {
        Quiet: false,
        Objects: filesToPruneScan.map((item) => ({ Key: item.object_key })),
      },
    })
  );

  console.log("[pruneFiles] S3 Bulk file prune result:", {
    pruned: formatBigArray(s3PruneResult.Deleted),
    errors: formatBigArray(s3PruneResult.Errors),
    meta: s3PruneResult.$metadata,
  });

  let errors: PruneResult["errors"] = [];
  let prunedS3Keys: string[] = [];

  for (const err of s3PruneResult.Errors || []) {
    if (err.Key) {
      errors.push({
        objectKey: err.Key,
        code: err.Code,
        message: err.Message,
      });
    }
  }

  for (const del of s3PruneResult.Deleted || []) {
    if (del.Key) prunedS3Keys.push(del.Key);
  }

  const dbFilesToPrune = filesToPruneScan.filter((file) =>
    prunedS3Keys.includes(file.object_key)
  );

  let dbPrunedRows: PruneResult["prunedFiles"] = [];

  if (prunedS3Keys.length) {
    dbPrunedRows = await db.transaction(async (tx) => {
      const messageAttachmentFilesToPrune = dbFilesToPrune.filter(
        (file) => file.purpose === FILE_PURPOSE.message_attachment
      );
      if (messageAttachmentFilesToPrune.length) {
        await tx.delete(schema.message_attachments).where(
          inArray(
            schema.message_attachments.file_id,
            messageAttachmentFilesToPrune.map((file) => file.id)
          )
        );
      }

      return await tx
        .delete(files)
        .where(
          inArray(
            files.id,
            dbFilesToPrune.map((file) => file.id)
          )
        )
        .returning({
          id: files.id,
          object_key: files.object_key,
          purpose: files.purpose,
        } satisfies Record<keyof PruneResult["prunedFiles"][number], unknown>);
    });

    console.log(
      "[pruneFiles] Files pruned from DB:",
      formatBigArray(dbPrunedRows)
    );
  }

  const pruneCountsMatch =
    new Set([dbFilesToPrune.length, prunedS3Keys.length, dbPrunedRows.length])
      .size === 1;

  const hasMoreData = pruneCountsMatch
    ? (await buildBaseQuery().limit(1)).length > 0
    : true;

  return {
    dbFilesToPruneCount: filesToPruneScan.length,
    s3PrunedKeysCount: prunedS3Keys.length,
    prunedFiles: dbPrunedRows,
    dbPrunedRowsCount: dbPrunedRows.length,
    pruneCountsMatch,
    hasMoreData,
    errors,
  };
};
