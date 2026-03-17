import React, { useEffect, useRef } from "react";

export const useEffectAfterMount = (
  effect: React.EffectCallback,
  dependencies: React.DependencyList
) => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    return effect();
    // eslint-disable-next-line
  }, dependencies);
};
