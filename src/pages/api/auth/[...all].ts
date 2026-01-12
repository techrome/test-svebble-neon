import { toNodeHandler } from "better-auth/node";
import type { NextApiHandler, PageConfig } from "next";

import { trpc } from "@/server";

const { SOME_AUTH_API_ROUTES, auth } = trpc;

export const config = {
  api: {
    bodyParser: false,
  },
} satisfies PageConfig;

const handler = toNodeHandler(auth.handler);

// Not exposing all better-auth routes to avoid any possible
// vulnerabilities like email enumeration
const WHITELISTED_PREFIXES = [
  SOME_AUTH_API_ROUTES.error,
  SOME_AUTH_API_ROUTES.callback,
  SOME_AUTH_API_ROUTES.verifyEmail,
  SOME_AUTH_API_ROUTES.resetPassword,
];

const limitedApiHandler: NextApiHandler = (req, res) => {
  const queryFirstSegment = req.query.all?.[0];

  if (WHITELISTED_PREFIXES.some((prefix) => queryFirstSegment === prefix)) {
    return handler(req, res);
  }
  return res.status(404).end();
};

export default limitedApiHandler;
