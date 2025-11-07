import { initTRPC } from "@trpc/server";
import superJSON from "superjson";

import { isDev } from "@@/scripts/helpers/isDev.mjs";

const trpc = initTRPC.create({
  isDev,
  transformer: superJSON,
});

export const router = trpc.router;
export const procedure = trpc.procedure;
