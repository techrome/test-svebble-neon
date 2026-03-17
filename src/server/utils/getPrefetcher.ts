import { createServerSideHelpers } from "@trpc/react-query/server";
import superJSON from "superjson";

import { trpc } from "@/server";

export const getPrefetcher = async (withDefaultData: boolean = true) => {
  const helpers = createServerSideHelpers({
    router: trpc.appRouter,
    ctx: await trpc.createTRPCContext(),
    transformer: superJSON,
  });
  if (withDefaultData) {
    await helpers.globalData.prefetch();
  }
  return helpers;
};
