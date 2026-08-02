import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import humanizeDuration from "humanize-duration";

import { db } from "../../db";
import * as schema from "../../db/schema";
import { before, nowMinus } from "../../db/helpers/time";
import { runChunksConcurrently } from "../../utils/concurrency";
import { pruneFiles } from "./pruneFiles";

type PruneResult = {
  prunedMessagesCount: number;
  pruneCountsMatch: boolean;
  hasMoreData: boolean;
};

const sameSet = (a: Set<unknown>, b: Set<unknown>) => {
  if (a.size !== b.size) return false;

  for (const value of a) {
    if (!b.has(value)) return false;
  }

  return true;
};

export const pruneMessages = async (
  props:
    | {
        criteria: "deleted";
        howOldMs?: number;
      }
    | {
        criteria: "by channel id";
        channelId: number;
      }
    | {
        criteria: "by user id";
        userId: string;
      }
): Promise<PruneResult> => {
  const isByDeleted = props.criteria === "deleted";
  const isByChannelId = props.criteria === "by channel id";
  const isByUserId = props.criteria === "by user id";
  console.log(
    `[pruneMessages] Started. Pruning ${isByChannelId ? `"${props.criteria} ${props.channelId}"` : isByUserId ? `"${props.criteria} ${props.userId}"` : props.criteria} messages ${isByDeleted ? `older than ${humanizeDuration(props.howOldMs || 0)}` : ""}`
  );

  const limit = 10000;

  const filter = and(
    isByDeleted
      ? and(
          before(schema.messages.deleted_at, nowMinus(props.howOldMs || 0)),
          isNotNull(schema.messages.deleted_at)
        )
      : undefined,
    isByChannelId ? eq(schema.messages.channel_id, props.channelId) : undefined,
    isByUserId ? eq(schema.messages.user_id, props.userId) : undefined
  );

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  type QueryTx = typeof db | Tx;

  const buildBaseQuery = (tx: QueryTx) =>
    tx
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(filter)
      .orderBy(asc(schema.messages.deleted_at), asc(schema.messages.id));

  const buildFullQuery = (tx: QueryTx = db, messagesLimit: number = limit) => {
    const messagesSubquery = tx
      .$with("messages_to_prune")
      .as(buildBaseQuery(tx).limit(messagesLimit));
    return tx
      .with(messagesSubquery)
      .select({
        message_id: messagesSubquery.id,
        file_id: schema.message_attachments.file_id,
      })
      .from(messagesSubquery)
      .leftJoin(
        schema.message_attachments,
        eq(schema.message_attachments.message_id, messagesSubquery.id)
      )
      .orderBy(asc(messagesSubquery.id));
  };

  const rows = await buildFullQuery();

  const initialMessageIdsToPrune = new Set<number>();
  const dbFileIdsToPrune = new Set<string>();

  rows.forEach((row) => {
    initialMessageIdsToPrune.add(row.message_id);
    if (row.file_id) {
      dbFileIdsToPrune.add(row.file_id);
    }
  });

  if (dbFileIdsToPrune.size) {
    await runChunksConcurrently(
      [...dbFileIdsToPrune],
      999,
      3,
      async (idsChunk) => {
        await pruneFiles({
          criteria: "by id",
          idsToPrune: idsChunk,
        });
      }
    );
  }

  const { prunedMessageIds, hasMoreData } = await db.transaction(async (tx) => {
    const updatedRows = await buildFullQuery(tx);

    const messageIdsWithoutAttachments = [
      ...new Set(
        updatedRows.filter((x) => Boolean(!x.file_id)).map((x) => x.message_id)
      ),
    ];

    if (!messageIdsWithoutAttachments.length) {
      return {
        prunedMessageIds: [],
        hasMoreData: (await buildFullQuery(tx, 1)).length > 0,
      };
    }

    const prunedMessageIds = (
      await tx
        .delete(schema.messages)
        .where(inArray(schema.messages.id, messageIdsWithoutAttachments))
        .returning({ id: schema.messages.id })
    ).map((x) => x.id);

    const hasMoreData = (await buildFullQuery(tx, 1)).length > 0;

    return {
      prunedMessageIds,
      hasMoreData,
    };
  });

  const prunedMessagesCount = prunedMessageIds.length;
  console.log(
    `[pruneMessages] Finished. Pruned messages count: ${prunedMessagesCount}`
  );

  return {
    hasMoreData,
    pruneCountsMatch: sameSet(
      initialMessageIdsToPrune,
      new Set(prunedMessageIds)
    ),
    prunedMessagesCount,
  };
};
