import { useContext, useEffect, useId } from "react";
import { UseTRPCQueryResult } from "@trpc/react-query/shared";
import { TRPCClientErrorLike } from "@trpc/client";

import { LoadingBoundaryContext } from "@/utils/loadingBoundaryContext";
import type { AppRouter } from "@/trpc/server/routers/app";
import { useAppSnackbar } from "@/utils/snackbar";
import { VerticalStack } from "@/components/Layout/Containers";

const useAppQuery = <
  T extends UseTRPCQueryResult<unknown, TRPCClientErrorLike<AppRouter>>,
>(
  queryData: T
): T => {
  const uniqueKey = useId();
  const { setQueryKeys } = useContext(LoadingBoundaryContext);
  const { addAppSnackbar } = useAppSnackbar();

  const removeQueryKey = () => {
    setQueryKeys((prev) => {
      let updatedQueryKeys = { ...prev };
      delete updatedQueryKeys[uniqueKey];
      return updatedQueryKeys;
    });
  };

  useEffect(() => {
    const hasAnything = Boolean(queryData.data || queryData.error);

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

  useEffect(() => {
    const error = queryData.error;
    if (error) {
      addAppSnackbar({
        message: `Error: ${error.data?.code} - ${error?.data?.path}`,
        variant: "error",
        details: (
          <VerticalStack>
            <span>
              <strong>Error message:</strong>
              <br /> {error.message}
            </span>
            <span>
              <strong>Error HTTP code:</strong> <br />
              {error.data?.httpStatus}
            </span>
            {Boolean(error.data?.zodError) && (
              <span>
                <strong>Error validation:</strong> <br />
                <pre className="whitespace-break-spaces">
                  {JSON.stringify(error.data?.zodError?.tree, null, 2)}
                </pre>
              </span>
            )}
          </VerticalStack>
        ),
      });
    }
  }, [queryData.error]);

  return queryData;
};

export default useAppQuery;
