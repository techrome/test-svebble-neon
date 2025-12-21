import { createServerSideHelpers } from "@trpc/react-query/server";
import superJSON from "superjson";

import { trpc } from "@/server";

export const prepareDefaultData = async () => {
  const helpers = createServerSideHelpers({
    router: trpc.appRouter,
    ctx: {},
    transformer: superJSON,
  });
  await helpers.globalData.prefetch();
  return helpers;
};
