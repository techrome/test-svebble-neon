import React from "react";

export const useLatest = <T>(value: T) => {
  const ref = React.useRef<T>(value);
  // eslint-disable-next-line
  ref.current = value;
  return ref;
};
