import React from "react";

import {
  LoadingBoundaryContext,
  type QueryKeys,
} from "@/utils/loadingBoundaryContext";
import AnimationWrapper from "./AnimationWrapper";

const LoadingBoundary = ({ children }: { children: React.ReactNode }) => {
  const [queryKeys, setQueryKeys] = React.useState<QueryKeys>({});
  const hasActiveQueries = Object.keys(queryKeys).length > 0;

  return (
    <LoadingBoundaryContext.Provider value={{ queryKeys, setQueryKeys }}>
      <AnimationWrapper active={hasActiveQueries}>{children}</AnimationWrapper>
    </LoadingBoundaryContext.Provider>
  );
};

export default LoadingBoundary;
