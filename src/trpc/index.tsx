import type { inferRouterOutputs } from "@trpc/server";
import {
  httpBatchLink,
  TRPCClientError,
  TRPCClientErrorLike,
} from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import { getQueryKey } from "@trpc/react-query";
import superJSON from "superjson";

import type { AppRouter } from "@/server";
import { store } from "@/redux";
import { addSnackbar } from "@/redux/slices/snackbars";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { VerticalStack } from "@/components/Layout/Containers";
import { Typography } from "@mui/material";

const isBrowser = typeof window !== "undefined";

const getApiBaseUrl = () => {
  if (isBrowser) {
    return "";
  }
  return "";
};

const getErrorInfo = (
  error: TRPCClientErrorLike<AppRouter>,
  isLoggedIn: boolean = false
) => {
  const hasZodError = Boolean(error.data?.zodError);
  const shouldLogout =
    (error.data?.code === "UNAUTHORIZED" || error.data?.httpStatus === 401) &&
    isLoggedIn;

  const message = shouldLogout
    ? "Your session has expired. Please log in again."
    : hasZodError
      ? `Error: ${error?.data?.code} - ${error?.data?.path}`
      : error.message;

  const details = (
    <VerticalStack>
      {hasZodError && (
        <div>
          <Typography variant="body2" className="font-medium">
            Invalid fields:
          </Typography>
          {error.data?.zodError?.issues.map((issue, i) => (
            <div key={i}>
              <Typography variant="body2">
                {" "}
                <Typography
                  variant="body2"
                  className="underline"
                  component="span"
                >
                  {issue.path.join(".")}
                </Typography>{" "}
                - {issue.message}
              </Typography>
            </div>
          ))}
        </div>
      )}
      {!hasZodError && (
        <div>
          <Typography variant="body2" className="font-medium">
            Error message:
          </Typography>
          <Typography variant="body2">{error.message}</Typography>
        </div>
      )}
      <div>
        <Typography variant="body2" className="font-medium">
          Error code:
        </Typography>
        <Typography variant="body2">
          {error.data?.httpStatus} - {error.data?.code}
        </Typography>
      </div>
      <div>
        <Typography variant="body2" className="font-medium">
          Error path:
        </Typography>
        <Typography variant="body2">{error.data?.path}</Typography>
      </div>
    </VerticalStack>
  );

  return {
    message,
    details,
    internal: {
      shouldLogout,
    },
  };
};

const handleError = (qc: QueryClient, error: Error) => {
  if (!isBrowser) {
    return;
  }

  if (error instanceof TRPCClientError) {
    const userKey = getQueryKey(trpc.auth.user, undefined, "query");
    const currentUserData = qc.getQueryData(
      userKey
    ) as RouterOutput["auth"]["user"];
    const errorInfo = getErrorInfo(error, Boolean(currentUserData.user));
    store.dispatch(
      addSnackbar({
        message: errorInfo.message,
        details: errorInfo.details,
        variant: "error",
      })
    );
    if (errorInfo.internal.shouldLogout) {
      qc.setQueryData(userKey, { user: null });
    }
  } else {
    store.dispatch(
      addSnackbar({
        message: error.message || "Something went wrong",
        variant: "error",
      })
    );
  }
};

const createQueryClient = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        handleError(queryClient, error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        handleError(queryClient, error);
      },
    }),
    defaultOptions: {
      queries: {
        retry: 1,
      },
    },
  });

  return queryClient;
};

let browserQueryClient: QueryClient | undefined;

const getQueryClient = () => {
  if (isBrowser) {
    if (!browserQueryClient) {
      browserQueryClient = createQueryClient();
    }
    return browserQueryClient;
  } else {
    return createQueryClient();
  }
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
      queryClient: getQueryClient(),
    };
  },
  transformer: superJSON,
  abortOnUnmount: true,
  ssr: false,
});

export type RouterOutput = inferRouterOutputs<AppRouter>;
