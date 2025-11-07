import { createServerSideHelpers } from "@trpc/react-query/server";
import superJSON from "superjson";

import { appRouter } from "@/trpc/server/routers/app";

export const prepareDefaultData = async () => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: {},
    transformer: superJSON,
  });
  await helpers.globalData.prefetch();
  return helpers;
};
