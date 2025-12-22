import { toNodeHandler } from "better-auth/node";
import { PageConfig } from "next";

import { dbUtils } from "@/server";

export const config = {
  api: {
    bodyParser: false,
  },
} satisfies PageConfig;

export default toNodeHandler(dbUtils.auth.handler);
