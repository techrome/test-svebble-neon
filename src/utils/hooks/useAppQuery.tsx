import { useContext, useEffect, useId } from "react";
import { UseTRPCQueryResult } from "@trpc/react-query/shared";
import { TRPCClientErrorLike } from "@trpc/client";

import { LoadingBoundaryContext } from "@/utils/loadingBoundaryContext";
import type { AppRouter } from "@/server";

export type UseAppQueryOptions = {
  disableLoadingBoundary?: boolean;
};

const useAppQuery = <
  T extends UseTRPCQueryResult<unknown, TRPCClientErrorLike<AppRouter>>,
>(
  queryData: T,
  options: UseAppQueryOptions = {}
): T => {
  const uniqueKey = useId();
  const { setQueryKeys } = useContext(LoadingBoundaryContext);

  const removeQueryKey = () => {
    setQueryKeys((prev) => {
      if (uniqueKey in prev) {
        let updatedQueryKeys = { ...prev };
        delete updatedQueryKeys[uniqueKey];
        return updatedQueryKeys;
      } else return prev;
    });
  };

  useEffect(() => {
    const hasAnything = Boolean(queryData.data || queryData.error);

    if (options.disableLoadingBoundary) {
      return;
    }

    if (queryData.isFetching && hasAnything) {
      setQueryKeys((prev) => ({
        ...prev,
        [uniqueKey]: true,
      }));
    } else {
      removeQueryKey();
    }

    return () => {
      removeQueryKey();
    };
    // eslint-disable-next-line
  }, [queryData.isFetching]);

  return queryData;
};

export default useAppQuery;
