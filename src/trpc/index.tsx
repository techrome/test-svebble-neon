import type { inferRouterOutputs } from "@trpc/server";
import {
  httpBatchLink,
  TRPCClientError,
  TRPCClientErrorLike,
} from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import superJSON from "superjson";

import type { AppRouter } from "@/server";
import { store } from "@/redux";
import { addSnackbar } from "@/redux/slices/snackbars";
import { getErrorInfo } from "@/utils/useAppQuery";

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
          mutations: {
            onError: (error) => {
              if (error instanceof TRPCClientError) {
                const errorInfo = getErrorInfo(error);
                store.dispatch(
                  addSnackbar({
                    message: errorInfo.message,
                    details: errorInfo.details,
                    variant: "error",
                  })
                );
              } else {
                store.dispatch(
                  addSnackbar({
                    message: error.message || "Something went wrong",
                    variant: "error",
                  })
                );
              }
            },
          },
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
