import type { inferRouterOutputs } from "@trpc/server";
import { httpBatchLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import superJSON from "superjson";

import type { AppRouter } from "@/trpc/server/routers/app";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }
  return "";
};

export const trpc = createTRPCNext<AppRouter>({
  config: () => {
    return {
      links: [
        httpBatchLink({
          url: `${getApiBaseUrl()}/api/trpc`,
          transformer: superJSON,
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            retry: 1,
          },
        },
      },
    };
  },
  transformer: superJSON,
  abortOnUnmount: true,
  ssr: false,
});

export type RouterOutput = inferRouterOutputs<AppRouter>;
