import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import humanizeDuration from "humanize-duration";

import { db } from "../../db";
import { messages } from "../../db/schema/messages";
import { before, nowMinus } from "../../db/helpers/time";

type PruneResult = {
  prunedMessagesCount: number;
  pruneCountsMatch: boolean;
  hasMoreData: boolean;
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
          before(messages.deleted_at, nowMinus(props.howOldMs || 0)),
          isNotNull(messages.deleted_at)
        )
      : undefined,
    isByChannelId ? eq(messages.channel_id, props.channelId) : undefined,
    isByUserId ? eq(messages.user_id, props.userId) : undefined
  );

  const { prunedMessageIds, hasMoreData } = await db.transaction(async (tx) => {
    const buildBaseQuery = () =>
      tx
        .select({ id: messages.id })
        .from(messages)
        .where(filter)
        .orderBy(asc(messages.deleted_at), asc(messages.id));

    const messagesToPrune = buildBaseQuery().limit(limit);

    const prunedMessageIds = await tx
      .delete(messages)
      .where(inArray(messages.id, messagesToPrune))
      .returning({ id: messages.id });

    const hasMoreData =
      prunedMessageIds.length === limit
        ? (await buildBaseQuery().limit(1)).length > 0
        : false;

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
    pruneCountsMatch: true,
    prunedMessagesCount,
  };
};
