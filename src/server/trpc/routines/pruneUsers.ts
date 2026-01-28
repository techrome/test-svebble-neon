import { and, asc, eq, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import humanizeDuration from "humanize-duration";

import { db } from "../../db";
import { session, user } from "../../db/schema/auth";
import { after, before, nowMinus } from "../../db/helpers/time";
import { pruneFiles } from "./pruneFiles";
import { formatBigArray } from "../../../utils/formatBigArray";
import { runConcurrently } from "@/utils/concurrency";

type PruneResult = {
  usersToPruneCount: number;
  prunedUsersCount: number;
  pruneCountsMatch: boolean;
  hasMoreData: boolean;
};

export const pruneUsers = async ({
  howOldMs = 0,
  criteria,
}: {
  criteria: "deleted" | "inactive guest";
  howOldMs?: number;
}): Promise<PruneResult> => {
  console.log(
    `[pruneUsers] Started. Pruning ${criteria} users older than ${humanizeDuration(howOldMs)}`
  );

  const limit = 2000;

  const filter =
    criteria === "inactive guest"
      ? and(
          eq(user.isAnonymous, true),
          notExists(
            db
              .select()
              .from(session)
              .where(
                and(
                  eq(session.userId, user.id),
                  after(session.expiresAt, sql`now()`)
                )
              )
          )
        )
      : and(
          isNotNull(user.deletedAt),
          before(user.deletedAt, nowMinus(howOldMs))
        );

  const buildBaseQuery = () =>
    db
      .select({
        id: user.id,
        deleted_at: user.deletedAt,
      })
      .from(user)
      .where(filter)
      .orderBy(asc(user.deletedAt));

  const usersToPrune = await buildBaseQuery().limit(limit);

  if (!usersToPrune.length) {
    console.log("[pruneUsers] No users to prune. Aborting");
    return {
      usersToPruneCount: 0,
      prunedUsersCount: 0,
      pruneCountsMatch: true,
      hasMoreData: false,
    };
  } else {
    console.log("[pruneUsers] Users to prune:", formatBigArray(usersToPrune));
  }

  let userIdsToPrune: Array<(typeof user.$inferSelect)["id"]> = [];

  await runConcurrently(usersToPrune, 10, async (userRow) => {
    const userFilesPruneResult = await pruneFiles({ userId: userRow.id });
    if (
      !userFilesPruneResult.hasMoreData &&
      userFilesPruneResult.pruneCountsMatch
    ) {
      userIdsToPrune.push(userRow.id);
    }
  });

  let prunedUsersCount = 0;
  if (userIdsToPrune.length) {
    const prunedUserRows = await db
      .delete(user)
      .where(inArray(user.id, userIdsToPrune))
      .returning();
    prunedUsersCount = prunedUserRows.length;
    console.log("[pruneUsers] Users count pruned from DB:", prunedUsersCount);
  }

  const pruneCountsMatch =
    new Set([usersToPrune.length, prunedUsersCount]).size === 1;

  const hasMoreData = pruneCountsMatch
    ? (await buildBaseQuery().limit(1)).length > 0
    : true;

  return {
    usersToPruneCount: usersToPrune.length,
    prunedUsersCount,
    pruneCountsMatch,
    hasMoreData,
  };
};
