import * as trpcNext from "@trpc/server/adapters/next";

import { trpc } from "@/server";

export default trpcNext.createNextApiHandler({
  router: trpc.appRouter,
  createContext: () => ({}),
});
