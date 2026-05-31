import type { NextApiRequest, NextApiResponse } from "next";

import * as trpcNext from "@trpc/server/adapters/next";
import { trpc } from "@/server";
import { MAX_BATCH_CALLS } from "@/trpc";

const getTrpcBatchSize = (req: NextApiRequest) => {
  const trpcPathParam = req.query.trpc;

  const trpcPath = Array.isArray(trpcPathParam)
    ? trpcPathParam.join("/")
    : trpcPathParam || "";

  const isBatchRequest = req.query.batch === "1";

  if (!isBatchRequest) return 1;

  return trpcPath.split(",").length;
};

const trpcHandler = trpcNext.createNextApiHandler({
  router: trpc.appRouter,
  createContext: trpc.createTRPCContext,
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const batchSize = getTrpcBatchSize(req);

  if (batchSize > MAX_BATCH_CALLS) {
    res.status(400).json({
      error: {
        message: `Batch size limit exceeded. Max batch size is ${MAX_BATCH_CALLS}.`,
      },
    });
    return;
  }

  return trpcHandler(req, res);
}
