import type { NextApiRequest, NextApiResponse } from "next";

import { trpc } from "@/server";
import { withCronAuth } from "../../../server/trpc/helpers/cronHelpers";

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const pruneResult = await trpc.routines.pruneUsers({
    criteria: "inactive guest",
  });
  console.log("Prune inactive guest users result:", pruneResult);
  res.status(200).json({ ok: true, ranAt: new Date().toISOString() });
};

export default withCronAuth(handler);
