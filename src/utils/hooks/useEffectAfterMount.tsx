import React from "react";

export const useEffectAfterMount = (
  effect: React.EffectCallback,
  dependencies: React.DependencyList
) => {
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    return effect();
    // eslint-disable-next-line
  }, dependencies);
};
