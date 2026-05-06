import { and, asc, inArray, isNotNull } from "drizzle-orm";
import humanizeDuration from "humanize-duration";

import { db } from "../../db";
import { channels } from "../../db/schema/channels";
import { before, nowMinus } from "../../db/helpers/time";
import { pruneMessages } from "./pruneMessages";
import { formatBigArray } from "../../../utils/formatBigArray";
import { runConcurrently } from "../../utils/concurrency";

type PruneResult = {
  channelsToPruneCount: number;
  prunedChannelsCount: number;
  pruneCountsMatch: boolean;
  hasMoreData: boolean;
};

export const pruneChannels = async ({
  howOldMs = 0,
  criteria,
}: {
  criteria: "deleted";
  howOldMs?: number;
}): Promise<PruneResult> => {
  console.log(
    `[pruneChannels] Started. Pruning ${criteria} channels older than ${humanizeDuration(howOldMs)}`
  );

  const limit = 500;

  const filter = and(
    isNotNull(channels.deleted_at),
    before(channels.deleted_at, nowMinus(howOldMs))
  );

  const buildBaseQuery = () =>
    db
      .select({
        id: channels.id,
      })
      .from(channels)
      .where(filter)
      .orderBy(asc(channels.deleted_at), asc(channels.id));

  const channelsToPrune = await buildBaseQuery().limit(limit);

  if (!channelsToPrune.length) {
    console.log("[pruneChannels] No channels to prune. Aborting");
    return {
      channelsToPruneCount: 0,
      prunedChannelsCount: 0,
      pruneCountsMatch: true,
      hasMoreData: false,
    };
  } else {
    console.log(
      "[pruneChannels] Channels to prune:",
      formatBigArray(channelsToPrune)
    );
  }

  let channelIdsToPrune: Array<(typeof channels.$inferSelect)["id"]> = [];

  await runConcurrently(channelsToPrune, 10, async (channelRow) => {
    const channelMessagesPruneResult = await pruneMessages({
      criteria: "by channel id",
      channelId: channelRow.id,
    });
    if (
      !channelMessagesPruneResult.hasMoreData &&
      channelMessagesPruneResult.pruneCountsMatch
    ) {
      channelIdsToPrune.push(channelRow.id);
    }
  });

  let prunedChannelsCount = 0;
  if (channelIdsToPrune.length) {
    const prunedChannelRows = await db
      .delete(channels)
      .where(inArray(channels.id, channelIdsToPrune))
      .returning();
    prunedChannelsCount = prunedChannelRows.length;
    console.log(
      "[pruneChannels] Channels count pruned from DB:",
      prunedChannelsCount
    );
  }

  const pruneCountsMatch =
    new Set([channelsToPrune.length, prunedChannelsCount]).size === 1;

  const hasMoreData = pruneCountsMatch
    ? (await buildBaseQuery().limit(1)).length > 0
    : true;

  return {
    channelsToPruneCount: channelsToPrune.length,
    prunedChannelsCount,
    pruneCountsMatch,
    hasMoreData,
  };
};
