import { useContext, useEffect, useId } from "react";
import { UseTRPCQueryResult } from "@trpc/react-query/shared";
import { TRPCClientErrorLike } from "@trpc/client";

import { LoadingBoundaryContext } from "@/utils/loadingBoundaryContext";
import type { AppRouter } from "@/server";
import { useAppSnackbar } from "@/utils/snackbar";
import { VerticalStack } from "@/components/Layout/Containers";
import { Typography } from "@mui/material";

export const getErrorInfo = (error: TRPCClientErrorLike<AppRouter>) => {
  const hasZodError = Boolean(error.data?.zodError);

  const message = hasZodError
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
          Error HTTP code:
        </Typography>
        <Typography variant="body2">{error.data?.httpStatus}</Typography>
      </div>
    </VerticalStack>
  );

  return {
    message,
    details,
  };
};

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
      const errorInfo = getErrorInfo(error);
      addAppSnackbar({
        message: errorInfo.message,
        details: errorInfo.details,
        variant: "error",
      });
    }
  }, [queryData.error]);

  return queryData;
};

export default useAppQuery;
