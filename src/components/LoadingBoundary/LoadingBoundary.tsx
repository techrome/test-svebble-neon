import React, { useState } from "react";

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

  return (
    <LoadingBoundaryContext.Provider value={{ queryKeys, setQueryKeys }}>
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
