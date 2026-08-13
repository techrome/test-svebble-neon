import React, { useCallback, useState } from "react";

import {
  LoadingBoundaryContext,
  type QueryKeys,
} from "@/utils/loadingBoundaryContext";
import AnimationWrapper from "./AnimationWrapper";

type Props = {
  children: React.ReactNode;
  alwaysActive?: boolean;
  isOuter?: boolean;
  addClassName?: string;
};

const LoadingBoundary = ({
  children,
  alwaysActive,
  isOuter,
  addClassName,
}: Props) => {
  const [queryKeys, setQueryKeys] = useState<QueryKeys>({});
  const hasActiveQueries = Object.keys(queryKeys).length > 0;

  const reportQueryLoading = useCallback(
    (queryKey: string, active: boolean) => {
      setQueryKeys((prev) => {
        const wasActive = queryKey in prev;

        if (wasActive === active) return prev;

        if (active) {
          return {
            ...prev,
            [queryKey]: true,
          };
        } else {
          let next = { ...prev };
          delete next[queryKey];
          return next;
        }
      });
    },
    []
  );

  return (
    <LoadingBoundaryContext.Provider value={reportQueryLoading}>
      <AnimationWrapper
        active={alwaysActive || hasActiveQueries}
        isOuter={isOuter}
        addClassName={addClassName}
      >
        {children}
      </AnimationWrapper>
    </LoadingBoundaryContext.Provider>
  );
};

export default LoadingBoundary;
