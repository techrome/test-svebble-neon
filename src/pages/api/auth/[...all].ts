import { toNodeHandler } from "better-auth/node";
import { PageConfig } from "next";

import { trpc } from "@/server";

export const config = {
  api: {
    bodyParser: false,
  },
} satisfies PageConfig;

export default toNodeHandler(trpc.auth.handler);
