import { toNodeHandler } from "better-auth/node";
import type { NextApiHandler, PageConfig } from "next";

import { trpc } from "@/server";

export const config = {
  api: {
    bodyParser: false,
  },
} satisfies PageConfig;

const handler = toNodeHandler(trpc.auth.handler);

// Not exposing all better-auth routes to avoid any possible
// vulnerabilities like email enumeration
const WHITELISTED_PREFIXES = ["error", "callback"];

const limitedApiHandler: NextApiHandler = (req, res) => {
  const queryFirstSegment = req.query.all?.[0];

  if (WHITELISTED_PREFIXES.some((prefix) => queryFirstSegment === prefix)) {
    return handler(req, res);
  }
  return res.status(404).end();
};

export default limitedApiHandler;
