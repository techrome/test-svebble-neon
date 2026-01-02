import React from "react";

const usePrevious = <T,>(value: T) => {
  const ref = React.useRef(value);

  React.useEffect(() => {
    ref.current = value;
  }, [value]);

  // eslint-disable-next-line
  return ref.current;
};

export default usePrevious;
