import { useContext, useEffect, useId } from "react";
import { UseTRPCQueryResult } from "@trpc/react-query/shared";
import { TRPCClientErrorLike } from "@trpc/client";

import { LoadingBoundaryContext } from "@/utils/loadingBoundaryContext";
import type { AppRouter } from "@/server";

type Options = {
  disableLoadingBoundary?: boolean;
};

const useAppQuery = <
  T extends UseTRPCQueryResult<unknown, TRPCClientErrorLike<AppRouter>>,
>(
  queryData: T,
  options: Options = {}
): T => {
  const uniqueKey = useId();
  const { setQueryKeys } = useContext(LoadingBoundaryContext);

  const removeQueryKey = () => {
    setQueryKeys((prev) => {
      let updatedQueryKeys = { ...prev };
      delete updatedQueryKeys[uniqueKey];
      return updatedQueryKeys;
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
  }, [queryData.isFetching]);

  return queryData;
};

export default useAppQuery;
