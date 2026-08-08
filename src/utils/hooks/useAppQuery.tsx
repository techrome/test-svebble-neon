import { useContext, useEffect, useId } from "react";
import { type UseTRPCQueryResult } from "@trpc/react-query/shared";
import { type UseInfiniteQueryResult } from "@tanstack/react-query";
import { type TRPCClientErrorLike } from "@trpc/client";

import { LoadingBoundaryContext } from "@/utils/loadingBoundaryContext";
import type { AppRouter } from "@/server";

export type UseAppQueryOptions = {
  disableLoadingBoundary?: boolean;
};

type AppQueryLike<TData, TError> =
  | UseTRPCQueryResult<TData, TError>
  | UseInfiniteQueryResult<TData, TError>;

const useAppQuery = <
  T extends AppQueryLike<unknown, TRPCClientErrorLike<AppRouter>>,
>(
  queryData: T,
  options: UseAppQueryOptions = {}
) => {
  const uniqueKey = useId();
  const reportQueryLoading = useContext(LoadingBoundaryContext);

  useEffect(() => {
    if (options.disableLoadingBoundary || !queryData.isRefetching) {
      return;
    }

    reportQueryLoading(uniqueKey, true);

    return () => {
      reportQueryLoading(uniqueKey, false);
    };
  }, [
    options.disableLoadingBoundary,
    queryData.isRefetching,
    reportQueryLoading,
    uniqueKey,
  ]);

  return queryData;
};

export default useAppQuery;
