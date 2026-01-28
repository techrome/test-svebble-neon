import type { NextApiRequest, NextApiResponse } from "next";

import { trpc } from "@/server";
import { days } from "@/utils/cacheTime";
import { FILE_STATUS } from "../../../server/db/helpers/enums";
import { withCronAuth } from "../../../server/trpc/helpers/cronHelpers";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const pruneResult = await trpc.routines.pruneFiles({
    statusesToDelete: [FILE_STATUS.deleted, FILE_STATUS.error],
    howOldMs: days(1),
  });
  console.log("Prune errored files result:", pruneResult);
  res.status(200).json({ ok: true, ranAt: new Date().toISOString() });
};

export default withCronAuth(handler);
