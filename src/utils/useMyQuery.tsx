import { useContext, useEffect, useId } from "react";

import { LoadingBoundaryContext } from "@/utils/loadingBoundaryContext";

type Props = {
  isFetching: boolean;
};

const useMyQuery = <T extends Props>(queryData: T): T => {
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
    if (queryData.isFetching) {
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

export default useMyQuery;
