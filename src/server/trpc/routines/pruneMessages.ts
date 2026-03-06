import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import humanizeDuration from "humanize-duration";

import { db } from "../../db";
import { messages } from "../../db/schema/messages";
import { before, nowMinus } from "../../db/helpers/time";

type PruneResult = {
  prunedMessagesCount: number;
  hasMoreData: boolean;
};

export const pruneMessages = async (
  props: {
    howOldMs?: number;
  } & (
    | {
        criteria: "deleted";
      }
    | {
        criteria: "by channel id";
        channelId: bigint;
      }
  )
): Promise<PruneResult> => {
  const howOldMs = props.howOldMs || 0;
  const isByChannelId = props.criteria === "by channel id";
  console.log(
    `[pruneMessages] Started. Pruning ${isByChannelId ? `"${props.criteria} ${props.channelId}"` : props.criteria} messages older than ${humanizeDuration(howOldMs)}`
  );

  const limit = 10000;

  const filter = and(
    isNotNull(messages.deleted_at),
    before(messages.deleted_at, nowMinus(howOldMs)),
    isByChannelId ? eq(messages.channel_id, props.channelId) : undefined
  );

  const { prunedMessageIds, hasMoreData } = await db.transaction(async (tx) => {
    const buildBaseQuery = () =>
      tx
        .select({ id: messages.id })
        .from(messages)
        .where(filter)
        .orderBy(asc(messages.deleted_at), asc(messages.id));

    const messageIdsToDelete = buildBaseQuery().limit(limit);

    const prunedMessageIds = await tx
      .delete(messages)
      .where(inArray(messages.id, messageIdsToDelete))
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

  return {
    hasMoreData,
    prunedMessagesCount: prunedMessageIds.length,
  };
};
