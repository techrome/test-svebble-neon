import type { NextApiRequest, NextApiResponse } from "next";

import { trpc } from "@/server";
import { days } from "@/utils/cacheTime";
import { withCronAuth } from "../../../server/trpc/helpers/cronHelpers";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const pruneResult = await trpc.routines.pruneChannels({
    criteria: "deleted",
    howOldMs: days(1),
  });
  console.log("Prune deleted channels result:", pruneResult);
  res.status(200).json({ ok: true, ranAt: new Date().toISOString() });
};

export default withCronAuth(handler);
