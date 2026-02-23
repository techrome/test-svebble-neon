import React from "react";

import {
  LoadingBoundaryContext,
  type QueryKeys,
} from "@/utils/loadingBoundaryContext";
import AnimationWrapper from "./AnimationWrapper";

type Props = {
  children: React.ReactNode;
  alwaysActive?: boolean;
  isOuter?: boolean;
  minH?: boolean;
};

const LoadingBoundary = ({ children, alwaysActive, isOuter, minH }: Props) => {
  const [queryKeys, setQueryKeys] = React.useState<QueryKeys>({});
  const hasActiveQueries = Object.keys(queryKeys).length > 0;

  return (
    <LoadingBoundaryContext.Provider value={{ queryKeys, setQueryKeys }}>
      <AnimationWrapper
        active={alwaysActive || hasActiveQueries}
        isOuter={isOuter}
        minH={minH}
      >
        {children}
      </AnimationWrapper>
    </LoadingBoundaryContext.Provider>
  );
};

export default LoadingBoundary;
